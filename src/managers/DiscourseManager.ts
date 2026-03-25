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

    private async findUserForumNameByEmail(userEmail: string): Promise<string|null> {
        console.log(`findUserForumNameByEmail ${userEmail}`);
        const apiEndpoint = `/admin/users/list/active.json?email=${userEmail}`;
        const { url, options } = this.prepareAuthenticatedRequest(apiEndpoint, 'GET');
        try {
            const response = await this.fetchWithRetry(url, options);
            console.log(` -> findUserForumNameByEmail response ${response.status}`);
            const userList = await response.json();
            if (userList.length === 0) {
                return null;
            } else {
                return userList[0].username;
            }
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    private async updateGroupMembership(userForumName: string, groupId: number, add: boolean): Promise<boolean> {
        console.log(`updateGroupMembership ${userForumName} ${groupId} ${add}`);
        const apiEndpoint = `/groups/${groupId}/members.json`;
        const { url, options } = this.prepareAuthenticatedRequest(apiEndpoint, add ? 'PUT' : 'DELETE');
        options.headers = {
            ...options.headers,
            'Content-Type': 'application/json',
        };
        options.body = JSON.stringify({
            usernames: userForumName,
        });
        try {
            const response = await this.fetchWithRetry(url, options);
            console.log(` -> updateGroupMembership response ${response.status}`);
            return response.status === 200;
        } catch (error) {
			return false;
        }
    }

    public async addUserWithEmailToGroup(userEmail: string, groupId:number): Promise<boolean> {
        const userForumName = await this.findUserForumNameByEmail(userEmail);
        if (userForumName === null) {
            return false;
        } else {
            return await this.updateGroupMembership(userForumName, groupId, true);
        }
    }

    public async removeUserWithEmailFromGroup(userEmail: string, groupId:number): Promise<boolean> {
        const userForumName = await this.findUserForumNameByEmail(userEmail);
        let result: boolean;
        if (userForumName === null) {
            await this.revokeInviteByEmail(userEmail);
            console.log(`removeUserWithEmailFromGroup: user ${userEmail} not found in Discourse, treating as already removed from group ${groupId}`);
            result = true;
        } else {
            result = await this.updateGroupMembership(userForumName, groupId, false);
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
                    console.log(`revokeInviteByEmail: invite for ${email} successfully revoked`);
                }
                result = destroyResponse.ok;
            } else {
                console.log(`revokeInviteByEmail: no pending invite found for ${email}`);
                result = true;
            }
        } catch (error) {
            console.error(`revokeInviteByEmail: error revoking invite for ${email}`, error);
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

    public async inviteUserByEmailToGroup(email: string, groupId: number): Promise<boolean> {
        const apiEndpoint = '/invites';
        const { url, options } = this.prepareAuthenticatedRequest(apiEndpoint, 'POST');
        options.headers = {
            ...options.headers,
            'Content-Type': 'application/json',
        };
        options.body = JSON.stringify({ email, group_ids: groupId, skip_email: false });
        try {
            const response = await this.fetchWithRetry(url, options);
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}
