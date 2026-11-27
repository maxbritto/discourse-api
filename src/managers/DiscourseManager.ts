export type DiscourseStep =
    | 'findUserForumNameByEmail'
    | 'updateGroupMembership'
    | 'checkGroupMembership'
    | 'inviteUserByEmailToGroup';

export interface DiscourseResult {
    success: boolean;
    step?: DiscourseStep;
    status?: number;
    error?: string;
    alreadyInState?: boolean;
    userNotFound?: boolean;
}

interface Identities {
    email?: string;
    username?: string;
}

type UserLookup = { username: string } | { notFound: true } | { failure: DiscourseResult };

const MAX_ERROR_LENGTH = 200;

export class DiscourseManager {
    private readonly baseURL: string;
    private readonly apiKey: string;
    private readonly apiUsername: string;

    constructor(baseURL: string, apiKey: string, apiUsername: string) {
        this.baseURL = baseURL;
        this.apiKey = apiKey;
        this.apiUsername = apiUsername;
    }

    private async fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
        let response: Response | null = null;
        let attempt = 0;
        const maxRetries = 5;

        while (response === null && attempt <= maxRetries) {
            response = await fetch(url, options);
            if ((response.status === 429 || response.status === 503) && attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 100;
                await new Promise(resolve => setTimeout(resolve, delay));
                response = null;
            }
            attempt++;
        }

        return response!;
    }

    private prepareAuthenticatedRequest(apiEndpoint: string, method: string): { url: string; options: RequestInit } {
        return {
            url: `${this.baseURL}${apiEndpoint}`,
            options: {
                method: method,
                headers: {
                    'Api-Key': this.apiKey,
                    'Api-Username': this.apiUsername,
                },
            },
        };
    }

    private async readBody(response: Response): Promise<{ text: string; json: unknown }> {
        const text = await response.text();
        let json: unknown = undefined;
        try {
            json = JSON.parse(text);
        } catch {
            json = undefined;
        }
        return { text, json };
    }

    private sanitizeMessage(message: string, identities: Identities): string {
        const forbidden = [identities.email, identities.email ? encodeURIComponent(identities.email) : undefined, identities.username]
            .filter((value): value is string => !!value);
        let cleaned = message;
        for (const value of forbidden) {
            cleaned = cleaned.replace(new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '<user>');
        }
        return cleaned.length > MAX_ERROR_LENGTH ? cleaned.slice(0, MAX_ERROR_LENGTH) : cleaned;
    }

    private extractDiscourseMessage(body: { text: string; json: unknown }): string {
        const json = body.json;
        const { errors, error, message } = (typeof json === 'object' && json !== null ? json : {}) as { errors?: unknown; error?: unknown; message?: unknown };
        let extracted: string;
        if (Array.isArray(errors) && errors.length > 0) {
            extracted = String(errors[0]);
        } else if (typeof error === 'string') {
            extracted = error;
        } else if (typeof message === 'string') {
            extracted = message;
        } else {
            extracted = body.text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }
        return extracted;
    }

    private async failureFromResponse(step: DiscourseStep, response: Response, identities: Identities): Promise<DiscourseResult> {
        let message = '';
        try {
            message = this.extractDiscourseMessage(await this.readBody(response));
        } catch {
            message = '';
        }
        const failure: DiscourseResult = { success: false, step, status: response.status };
        if (message) {
            failure.error = this.sanitizeMessage(message, identities);
        }
        console.error(`Discourse ${step} failed: HTTP ${response.status}`);
        return failure;
    }

    private failureFromException(step: DiscourseStep, error: unknown, identities: Identities): DiscourseResult {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Discourse ${step} failed: network error`);
        return { success: false, step, error: this.sanitizeMessage(`network error: ${message}`, identities) };
    }

    private async findUserForumNameByEmail(userEmail: string): Promise<UserLookup> {
        const step: DiscourseStep = 'findUserForumNameByEmail';
        const apiEndpoint = `/admin/users/list/all.json?email=${encodeURIComponent(userEmail)}`;
        const { url, options } = this.prepareAuthenticatedRequest(apiEndpoint, 'GET');
        const identities = { email: userEmail };
        try {
            const response = await this.fetchWithRetry(url, options);
            console.log(`${step}: HTTP ${response.status}`);
            if (!response.ok) {
                return { failure: await this.failureFromResponse(step, response, identities) };
            }
            const { json } = await this.readBody(response);
            if (!Array.isArray(json)) {
                console.error(`Discourse ${step} failed: unexpected response body`);
                return { failure: { success: false, step, status: response.status, error: 'unexpected response body' } };
            }
            if (json.length === 0) {
                return { notFound: true };
            }
            const first: unknown = json[0];
            const username = typeof first === 'object' && first !== null ? (first as { username?: unknown }).username : undefined;
            if (typeof username !== 'string' || username === '') {
                console.error(`Discourse ${step} failed: unexpected response body`);
                return { failure: { success: false, step, status: response.status, error: 'unexpected response body' } };
            }
            return { username };
        } catch (error) {
            return { failure: this.failureFromException(step, error, identities) };
        }
    }

    private async updateGroupMembership(userForumName: string, userEmail: string, groupId: number, add: boolean): Promise<DiscourseResult> {
        const step: DiscourseStep = 'updateGroupMembership';
        const apiEndpoint = `/groups/${groupId}/members.json`;
        const { url, options } = this.prepareAuthenticatedRequest(apiEndpoint, add ? 'PUT' : 'DELETE');
        options.headers = {
            ...options.headers,
            'Content-Type': 'application/json',
        };
        options.body = JSON.stringify({
            usernames: userForumName,
        });
        const identities = { email: userEmail, username: userForumName };
        let result: DiscourseResult;
        try {
            const response = await this.fetchWithRetry(url, options);
            console.log(`${step}: HTTP ${response.status}`);
            result = response.status === 200 ? { success: true } : await this.failureFromResponse(step, response, identities);
        } catch (error) {
            result = this.failureFromException(step, error, identities);
        }
        return result;
    }

    private async checkGroupMembership(userForumName: string, userEmail: string, groupId: number): Promise<{ member: boolean } | { failure: DiscourseResult }> {
        const step: DiscourseStep = 'checkGroupMembership';
        const { url, options } = this.prepareAuthenticatedRequest(`/u/${encodeURIComponent(userForumName)}.json`, 'GET');
        const identities = { email: userEmail, username: userForumName };
        try {
            const response = await this.fetchWithRetry(url, options);
            console.log(`${step}: HTTP ${response.status}`);
            if (!response.ok) {
                return { failure: await this.failureFromResponse(step, response, identities) };
            }
            const { json } = await this.readBody(response);
            const user = typeof json === 'object' && json !== null ? (json as { user?: unknown }).user : undefined;
            const groups = typeof user === 'object' && user !== null ? (user as { groups?: unknown }).groups : undefined;
            if (!Array.isArray(groups)) {
                return { failure: { success: false, step, status: response.status, error: 'unexpected response body' } };
            }
            return { member: groups.some((group: { id?: unknown } | null) => group?.id === groupId) };
        } catch (error) {
            return { failure: this.failureFromException(step, error, identities) };
        }
    }

    public async addUserWithEmailToGroup(userEmail: string, groupId: number): Promise<DiscourseResult> {
        const lookup = await this.findUserForumNameByEmail(userEmail);
        if ('failure' in lookup) {
            return lookup.failure;
        }
        if ('notFound' in lookup) {
            return { success: false, step: 'findUserForumNameByEmail', userNotFound: true };
        }
        const username = lookup.username;
        const update = await this.updateGroupMembership(username, userEmail, groupId, true);
        let result = update;
        if (!update.success && update.status === 422) {
            // Le texte du 422 est traduit par Discourse : on vérifie l'adhésion par une lecture plutôt que par le message.
            const check = await this.checkGroupMembership(username, userEmail, groupId);
            if ('failure' in check) {
                result = check.failure;
            } else if (check.member) {
                result = { success: true, alreadyInState: true };
            }
        }
        return result;
    }

    public async removeUserWithEmailFromGroup(userEmail: string, groupId: number): Promise<DiscourseResult> {
        const lookup = await this.findUserForumNameByEmail(userEmail);
        if ('failure' in lookup) {
            return lookup.failure;
        }
        let result: DiscourseResult;
        if ('notFound' in lookup) {
            await this.revokeInviteByEmail(userEmail);
            console.log(`removeUserWithEmailFromGroup: user not found in Discourse, treating as already removed from group ${groupId}`);
            result = { success: true, alreadyInState: true };
        } else {
            result = await this.updateGroupMembership(lookup.username, userEmail, groupId, false);
        }
        return result;
    }

    public async revokeInviteByEmail(email: string): Promise<boolean> {
        const { url: retrieveUrl, options: retrieveOptions } = this.prepareAuthenticatedRequest(`/invites/retrieve.json?email=${encodeURIComponent(email)}`, 'GET');
        let result: boolean;
        try {
            const retrieveResponse = await this.fetchWithRetry(retrieveUrl, retrieveOptions);
            const data = await retrieveResponse.json();
            if (data.invite && data.invite.id !== undefined) {
                const { url: destroyUrl, options: destroyOptions } = this.prepareAuthenticatedRequest('/invites', 'DELETE');
                destroyOptions.headers = {
                    ...destroyOptions.headers,
                    'Content-Type': 'application/json',
                };
                destroyOptions.body = JSON.stringify({ id: data.invite.id });
                const destroyResponse = await this.fetchWithRetry(destroyUrl, destroyOptions);
                if (destroyResponse.ok) {
                    console.log('revokeInviteByEmail: pending invite successfully revoked');
                }
                result = destroyResponse.ok;
            } else {
                console.log('revokeInviteByEmail: no pending invite found');
                result = true;
            }
        } catch (error) {
            console.error('revokeInviteByEmail: error revoking invite');
            result = false;
        }
        return result;
    }

    public async fetchGroupId(name: string): Promise<number> {
        const apiEndpoint = `/groups/${name}.json`;
        const { url, options } = this.prepareAuthenticatedRequest(apiEndpoint, 'GET');
        const response = await this.fetchWithRetry(url, options);

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Discourse fetchGroupId failed: ${response.status} ${response.statusText}. Body: ${body}`);
        }

        const data = await response.json();

        if (!data.group || data.group.id === undefined) {
            throw new Error(`Discourse fetchGroupId: no group data returned for "${name}"`);
        }

        return data.group.id;
    }

    public async inviteUserByEmailToGroup(email: string, groupId: number): Promise<DiscourseResult> {
        const step: DiscourseStep = 'inviteUserByEmailToGroup';
        const apiEndpoint = '/invites';
        const { url, options } = this.prepareAuthenticatedRequest(apiEndpoint, 'POST');
        options.headers = {
            ...options.headers,
            'Content-Type': 'application/json',
        };
        options.body = JSON.stringify({ email, group_ids: groupId, skip_email: false });
        let result: DiscourseResult;
        try {
            const response = await this.fetchWithRetry(url, options);
            result = response.ok ? { success: true } : await this.failureFromResponse(step, response, { email });
        } catch (error) {
            result = this.failureFromException(step, error, { email });
        }
        return result;
    }
}
