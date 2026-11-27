import { DiscourseManager } from '../src/managers/DiscourseManager';

const BASE_URL = 'https://forum.example.com';
const API_KEY = 'test-api-key';
const API_USERNAME = 'test-admin';
const TEST_EMAIL = 'user@example.com';
const TEST_USERNAME = 'johndoe';
const GROUP_ID = 42;

let manager: DiscourseManager;
let fetchMock: jest.Mock;

function mockFetchResponse(status: number, body: unknown = {}): Response {
    return {
        status,
        ok: status >= 200 && status < 300,
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    } as Response;
}

beforeEach(() => {
    manager = new DiscourseManager(BASE_URL, API_KEY, API_USERNAME);
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('addUserWithEmailToGroup', () => {
    test('returns true when user is found and added to group', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(200));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(true);
    });

    test('returns false when user is not found (empty list)', async () => {
        fetchMock.mockResolvedValueOnce(mockFetchResponse(200, []));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(false);
    });

    test('sends PUT request for group membership', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(200));

        await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        const groupCall = fetchMock.mock.calls[1];
        expect(groupCall[1].method).toBe('PUT');
    });
});

describe('removeUserWithEmailFromGroup', () => {
    test('returns true when user is found and removed from group', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(200));

        const result = await manager.removeUserWithEmailFromGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(true);
    });

    test('returns true when user is not found', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, []))
            .mockResolvedValueOnce(mockFetchResponse(200, {}));

        const result = await manager.removeUserWithEmailFromGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(true);
    });

    test('sends DELETE request for group membership', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(200));

        await manager.removeUserWithEmailFromGroup(TEST_EMAIL, GROUP_ID);

        const groupCall = fetchMock.mock.calls[1];
        expect(groupCall[1].method).toBe('DELETE');
    });
});

describe('authentication headers', () => {
    test('sends Api-Key and Api-Username headers on user lookup', async () => {
        fetchMock.mockResolvedValueOnce(mockFetchResponse(200, []));

        await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        const headers = fetchMock.mock.calls[0][1].headers;
        expect(headers['Api-Key']).toBe(API_KEY);
        expect(headers['Api-Username']).toBe(API_USERNAME);
    });

    test('sends Api-Key and Api-Username headers on group update', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(200));

        await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        const headers = fetchMock.mock.calls[1][1].headers;
        expect(headers['Api-Key']).toBe(API_KEY);
        expect(headers['Api-Username']).toBe(API_USERNAME);
    });
});

describe('request URLs and body', () => {
    test('builds correct user lookup URL', async () => {
        fetchMock.mockResolvedValueOnce(mockFetchResponse(200, []));

        await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        const url = fetchMock.mock.calls[0][0];
        expect(url).toBe(`${BASE_URL}/admin/users/list/all.json?email=${encodeURIComponent(TEST_EMAIL)}`);
    });

    test('builds correct group membership URL', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(200));

        await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        const url = fetchMock.mock.calls[1][0];
        expect(url).toBe(`${BASE_URL}/groups/${GROUP_ID}/members.json`);
    });

    test('sends JSON body with usernames field', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(200));

        await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        const body = JSON.parse(fetchMock.mock.calls[1][1].body);
        expect(body.usernames).toBe(TEST_USERNAME);
    });

    test('sends Content-Type application/json on group update', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(200));

        await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        const headers = fetchMock.mock.calls[1][1].headers;
        expect(headers['Content-Type']).toBe('application/json');
    });
});

describe('error handling', () => {
    test('returns false on network error during user lookup', async () => {
        fetchMock.mockRejectedValueOnce(new Error('Network error'));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(false);
    });

    test('returns false on network error during group update', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockRejectedValueOnce(new Error('Network error'));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(false);
    });

    test('returns false when group update returns non-200 status', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(403));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(false);
    });
});

describe('fetchGroupId', () => {
    test('returns the group id on success', async () => {
        fetchMock.mockResolvedValueOnce(mockFetchResponse(200, { group: { id: 45, name: 'test-group' } }));

        const result = await manager.fetchGroupId('test-group');

        expect(result).toBe(45);
        const url = fetchMock.mock.calls[0][0];
        expect(url).toBe(`${BASE_URL}/groups/test-group.json`);
    });

    test('throws when the API call fails', async () => {
        fetchMock.mockResolvedValueOnce({
            ...mockFetchResponse(404),
            text: () => Promise.resolve('not found'),
        } as Response);

        await expect(manager.fetchGroupId('nonexistent'))
            .rejects.toThrow('Discourse fetchGroupId failed: 404');
    });

    test('throws when group data is missing from response', async () => {
        fetchMock.mockResolvedValueOnce(mockFetchResponse(200, {}));

        await expect(manager.fetchGroupId('missing-group'))
            .rejects.toThrow('Discourse fetchGroupId: no group data returned for "missing-group"');
    });
});

describe('inviteUserByEmailToGroup', () => {
    test('returns true on success', async () => {
        fetchMock.mockResolvedValueOnce(mockFetchResponse(200));

        const result = await manager.inviteUserByEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(true);
        const url = fetchMock.mock.calls[0][0];
        expect(url).toBe(`${BASE_URL}/invites`);
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.email).toBe(TEST_EMAIL);
        expect(body.group_ids).toBe(GROUP_ID);
        expect(body.skip_email).toBe(false);
    });

    test('returns false when API call fails', async () => {
        fetchMock.mockResolvedValueOnce(mockFetchResponse(422));

        const result = await manager.inviteUserByEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(false);
    });

    test('returns false on network error', async () => {
        fetchMock.mockRejectedValueOnce(new Error('Network error'));

        const result = await manager.inviteUserByEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(false);
    });
});

describe('retry behavior', () => {
    test('retries on 429 and succeeds on second attempt', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(429))
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(200));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    test('retries on 503 and succeeds on second attempt', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(503))
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(200));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    test('returns false after exhausting retries on 429', async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(429));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(false);
        expect(fetchMock).toHaveBeenCalledTimes(6);
    }, 10000);

    test('does not retry on non-retryable error status', async () => {
        fetchMock.mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]));
        fetchMock.mockResolvedValueOnce(mockFetchResponse(500));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(false);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});

describe('revokeInviteByEmail', () => {
    test('returns true when invite is found and successfully revoked', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, { invite: { id: 99 } }))
            .mockResolvedValueOnce(mockFetchResponse(200));

        const result = await manager.revokeInviteByEmail(TEST_EMAIL);

        expect(result).toBe(true);
    });

    test('returns true when no pending invite exists', async () => {
        fetchMock.mockResolvedValueOnce(mockFetchResponse(200, {}));

        const result = await manager.revokeInviteByEmail(TEST_EMAIL);

        expect(result).toBe(true);
    });

    test('returns false on network error during invite retrieval', async () => {
        fetchMock.mockRejectedValueOnce(new Error('Network error'));

        const result = await manager.revokeInviteByEmail(TEST_EMAIL);

        expect(result).toBe(false);
    });

    test('sends correct URL for invite retrieval', async () => {
        fetchMock.mockResolvedValueOnce(mockFetchResponse(200, {}));

        await manager.revokeInviteByEmail(TEST_EMAIL);

        const url = fetchMock.mock.calls[0][0];
        expect(url).toBe(`${BASE_URL}/invites/retrieve.json?email=${encodeURIComponent(TEST_EMAIL)}`);
    });

    test('returns false when invite destroy fails', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, { invite: { id: 99 } }))
            .mockResolvedValueOnce(mockFetchResponse(500));

        const result = await manager.revokeInviteByEmail(TEST_EMAIL);

        expect(result).toBe(false);
    });

    test('sends correct URL for invite destruction when invite found', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, { invite: { id: 99 } }))
            .mockResolvedValueOnce(mockFetchResponse(200));

        await manager.revokeInviteByEmail(TEST_EMAIL);

        const destroyUrl = fetchMock.mock.calls[1][0];
        expect(destroyUrl).toBe(`${BASE_URL}/invites`);
        const destroyOptions = fetchMock.mock.calls[1][1];
        expect(destroyOptions.method).toBe('DELETE');
        const body = JSON.parse(destroyOptions.body);
        expect(body.id).toBe(99);
    });
});

describe('removeUserWithEmailFromGroup calls revokeInviteByEmail when user not found', () => {
    test('calls invite retrieve and destroy when user is absent from Discourse', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, []))
            .mockResolvedValueOnce(mockFetchResponse(200, { invite: { id: 55 } }))
            .mockResolvedValueOnce(mockFetchResponse(200));

        const result = await manager.removeUserWithEmailFromGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(true);
        const retrieveUrl = fetchMock.mock.calls[1][0];
        expect(retrieveUrl).toBe(`${BASE_URL}/invites/retrieve.json?email=${encodeURIComponent(TEST_EMAIL)}`);
        const destroyUrl = fetchMock.mock.calls[2][0];
        expect(destroyUrl).toBe(`${BASE_URL}/invites`);
    });

    test('returns true even when revokeInviteByEmail finds no invite', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, []))
            .mockResolvedValueOnce(mockFetchResponse(200, {}));

        const result = await manager.removeUserWithEmailFromGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(true);
    });
});

const PLUS_EMAIL = 'john.doe+forum@example.com';
const FRENCH_422 = { errors: ["Le nom d'utilisateur johndoe est déjà membre de ce groupe."], error_type: 'invalid_parameters' };

function mockHtmlResponse(status: number, html: string): Response {
    return {
        status,
        ok: status >= 200 && status < 300,
        json: () => Promise.reject(new SyntaxError('Unexpected token <')),
        text: () => Promise.resolve(html),
    } as Response;
}

function allConsoleOutput(): string {
    const calls = [
        ...(console.log as jest.Mock).mock.calls,
        ...(console.error as jest.Mock).mock.calls,
    ];
    return calls.flat().map(a => (a instanceof Error ? a.message : String(a))).join('\n');
}

describe('user lookup (findUserForumNameByEmail)', () => {
    test('encodes "+" in the email and searches all accounts', async () => {
        fetchMock.mockResolvedValueOnce(mockFetchResponse(200, []));

        await manager.addUserWithEmailToGroup(PLUS_EMAIL, GROUP_ID);

        expect(fetchMock.mock.calls[0][0]).toBe(`${BASE_URL}/admin/users/list/all.json?email=john.doe%2Bforum%40example.com`);
    });

    test('empty 2xx list means user not found (flagged userNotFound)', async () => {
        fetchMock.mockResolvedValueOnce(mockFetchResponse(200, []));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result).toMatchObject({ success: false, userNotFound: true, step: 'findUserForumNameByEmail' });
    });

    test.each([500, 403])('HTTP %i is a lookup failure, not "not found"', async (status) => {
        fetchMock.mockResolvedValueOnce(mockFetchResponse(status, { errors: ['boom'] }));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(false);
        expect(result.userNotFound).toBeFalsy();
        expect(result.step).toBe('findUserForumNameByEmail');
        expect(result.status).toBe(status);
    });

    test('persistent 429 is a lookup failure with status 429', async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(429, { errors: ['rate limited'] }));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result).toMatchObject({ success: false, step: 'findUserForumNameByEmail', status: 429 });
        expect(result.userNotFound).toBeFalsy();
    }, 10000);

    test('2xx body that is not an array is a lookup failure', async () => {
        fetchMock.mockResolvedValueOnce(mockFetchResponse(200, { errors: ['unexpected'] }));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(false);
        expect(result.userNotFound).toBeFalsy();
        expect(result.step).toBe('findUserForumNameByEmail');
    });

    test('2xx list whose first entry has no username is a lookup failure on add (no "not found")', async () => {
        fetchMock.mockResolvedValueOnce(mockFetchResponse(200, [{}]));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result).toMatchObject({ success: false, step: 'findUserForumNameByEmail', error: 'unexpected response body' });
        expect(result.userNotFound).toBeFalsy();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('2xx list whose first entry has no username is a lookup failure on remove (no revoke)', async () => {
        const revokeSpy = jest.spyOn(manager, 'revokeInviteByEmail');
        fetchMock.mockResolvedValueOnce(mockFetchResponse(200, [{}]));

        const result = await manager.removeUserWithEmailFromGroup(TEST_EMAIL, GROUP_ID);

        expect(result).toMatchObject({ success: false, step: 'findUserForumNameByEmail', error: 'unexpected response body' });
        expect(revokeSpy).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('network error is a lookup failure, not "not found"', async () => {
        fetchMock.mockRejectedValueOnce(new Error('socket hang up'));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(false);
        expect(result.userNotFound).toBeFalsy();
        expect(result.step).toBe('findUserForumNameByEmail');
        expect(result.status).toBeUndefined();
    });
});

describe('addUserWithEmailToGroup - detailed result and idempotence', () => {
    test('422 then membership check says member => success alreadyInState (message in French)', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(422, FRENCH_422))
            .mockResolvedValueOnce(mockFetchResponse(200, { user: { groups: [{ id: 7 }, { id: GROUP_ID }] } }));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(true);
        expect(result.alreadyInState).toBe(true);
        expect(fetchMock.mock.calls[2][0]).toBe(`${BASE_URL}/u/${TEST_USERNAME}.json`);
        expect(fetchMock.mock.calls[2][1].method).toBe('GET');
    });

    test('422 then membership check says not a member => failure updateGroupMembership 422 with message', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(422, { errors: ['Groupe verrouillé'] }))
            .mockResolvedValueOnce(mockFetchResponse(200, { user: { groups: [{ id: 7 }] } }));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result).toMatchObject({ success: false, step: 'updateGroupMembership', status: 422, error: 'Groupe verrouillé' });
    });

    test('422 then membership check fails (500) => failure checkGroupMembership, no further call', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(422, FRENCH_422))
            .mockResolvedValueOnce(mockFetchResponse(500, { errors: ['oops'] }));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result).toMatchObject({ success: false, step: 'checkGroupMembership', status: 500 });
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    test('422 then membership check 200 without groups => failure checkGroupMembership, no further call', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(422, FRENCH_422))
            .mockResolvedValueOnce(mockFetchResponse(200, { user: {} }));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result).toMatchObject({ success: false, step: 'checkGroupMembership', error: 'unexpected response body' });
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    test('422 then membership check network error => failure checkGroupMembership', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(422, FRENCH_422))
            .mockRejectedValueOnce(new Error('ECONNRESET'));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(false);
        expect(result.step).toBe('checkGroupMembership');
    });

    test('non-422 failure (403) does not trigger a membership check', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(403, { errors: ['forbidden'] }));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result).toMatchObject({ success: false, step: 'updateGroupMembership', status: 403 });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test('HTML error body keeps the HTTP status and a text excerpt', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockHtmlResponse(502, '<html><body>Bad gateway from proxy</body></html>'));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(false);
        expect(result.status).toBe(502);
        expect(result.error).toContain('Bad gateway');
    });

    test('network error on group update reports the step without status', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockRejectedValueOnce(new Error('timeout'));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result).toMatchObject({ success: false, step: 'updateGroupMembership' });
        expect(result.status).toBeUndefined();
    });
});

describe('removeUserWithEmailFromGroup - detailed result', () => {
    test('user found but not a member (200 with skipped_usernames) => success', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(200, { success: 'OK', skipped_usernames: [TEST_USERNAME] }));

        const result = await manager.removeUserWithEmailFromGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(true);
    });

    test.each([500, 403])('lookup failure (HTTP %i) => failure and revokeInviteByEmail is never called', async (status) => {
        const revokeSpy = jest.spyOn(manager, 'revokeInviteByEmail');
        fetchMock.mockResolvedValueOnce(mockFetchResponse(status, { errors: ['nope'] }));

        const result = await manager.removeUserWithEmailFromGroup(TEST_EMAIL, GROUP_ID);

        expect(result).toMatchObject({ success: false, step: 'findUserForumNameByEmail', status });
        expect(revokeSpy).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('lookup network error => failure and revokeInviteByEmail is never called', async () => {
        const revokeSpy = jest.spyOn(manager, 'revokeInviteByEmail');
        fetchMock.mockRejectedValueOnce(new Error('offline'));

        const result = await manager.removeUserWithEmailFromGroup(TEST_EMAIL, GROUP_ID);

        expect(result.success).toBe(false);
        expect(revokeSpy).not.toHaveBeenCalled();
    });

    test('group removal failure carries step and status', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(403, { errors: ['forbidden'] }));

        const result = await manager.removeUserWithEmailFromGroup(TEST_EMAIL, GROUP_ID);

        expect(result).toMatchObject({ success: false, step: 'updateGroupMembership', status: 403, error: 'forbidden' });
    });
});

describe('inviteUserByEmailToGroup - detailed result', () => {
    test('failure reports step, status and Discourse message', async () => {
        fetchMock.mockResolvedValueOnce(mockFetchResponse(422, { errors: ['Invitation impossible'] }));

        const result = await manager.inviteUserByEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result).toMatchObject({ success: false, step: 'inviteUserByEmailToGroup', status: 422, error: 'Invitation impossible' });
    });

    test('network error reports the step', async () => {
        fetchMock.mockRejectedValueOnce(new Error('offline'));

        const result = await manager.inviteUserByEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result).toMatchObject({ success: false, step: 'inviteUserByEmailToGroup' });
    });
});

describe('no PII in results and logs', () => {
    const PII_VARIANTS: Array<[string, string, string]> = [
        ['username', `Le compte ${TEST_USERNAME} ne peut pas être ajouté`, TEST_USERNAME],
        ['username in another case', 'Impossible d\'ajouter JohnDoe', TEST_USERNAME],
        ['raw email', `Refusé pour ${TEST_EMAIL}`, TEST_EMAIL],
        ['email in upper case', `Refusé pour ${TEST_EMAIL.toUpperCase()}`, TEST_EMAIL],
        ['URL-encoded email', `Refusé pour ${encodeURIComponent(TEST_EMAIL)}`, encodeURIComponent(TEST_EMAIL)],
    ];

    test.each(PII_VARIANTS)('Discourse message is stripped of %s placed in errors[0]', async (_label, message, forbidden) => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(403, { errors: [message] }));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect((result.error ?? '').toLowerCase()).not.toContain(forbidden.toLowerCase());
        expect(result.error).toContain('<user>');
    });

    test('PII sitting at the truncation boundary is still removed', async () => {
        const padding = 'x'.repeat(195);
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(403, { errors: [`${padding}${TEST_EMAIL}`] }));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(JSON.stringify(result)).not.toContain('user@');
        expect(JSON.stringify(result)).not.toContain('example.com');
    });

    test('a very long error message is truncated', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(403, { errors: ['y'.repeat(5000)] }));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect((result.error ?? '').length).toBeLessThanOrEqual(250);
    });

    test('no console output of add/remove/invite flows contains the email or username', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(422, FRENCH_422))
            .mockResolvedValueOnce(mockFetchResponse(200, { user: { groups: [{ id: GROUP_ID }] } }))
            .mockResolvedValueOnce(mockFetchResponse(200, []))
            .mockResolvedValueOnce(mockFetchResponse(200, { invite: { id: 5 } }))
            .mockResolvedValueOnce(mockFetchResponse(200))
            .mockResolvedValueOnce(mockFetchResponse(422, { errors: [`${TEST_EMAIL} ${TEST_USERNAME}`] }))
            .mockRejectedValueOnce(new Error(`network ${TEST_EMAIL}`));

        await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);
        await manager.removeUserWithEmailFromGroup(TEST_EMAIL, GROUP_ID);
        await manager.inviteUserByEmailToGroup(TEST_EMAIL, GROUP_ID);
        await manager.revokeInviteByEmail(TEST_EMAIL);

        const output = allConsoleOutput().toLowerCase();
        expect(output).not.toContain('user@example.com');
        expect(output).not.toContain(TEST_USERNAME);
    });

    test('revokeInviteByEmail logs contain no email on success, no invite and error paths', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, { invite: { id: 1 } }))
            .mockResolvedValueOnce(mockFetchResponse(200))
            .mockResolvedValueOnce(mockFetchResponse(200, {}))
            .mockRejectedValueOnce(new Error('boom'));

        await manager.revokeInviteByEmail(TEST_EMAIL);
        await manager.revokeInviteByEmail(TEST_EMAIL);
        await manager.revokeInviteByEmail(TEST_EMAIL);

        expect(allConsoleOutput().toLowerCase()).not.toContain('user@example.com');
    });

    test('network error message containing the email is sanitized in the result', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockRejectedValueOnce(new Error(`connect failed for ${TEST_EMAIL}`));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(JSON.stringify(result)).not.toContain(TEST_EMAIL);
    });
});
