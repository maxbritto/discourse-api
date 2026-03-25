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

        expect(result).toBe(true);
    });

    test('returns false when user is not found (empty list)', async () => {
        fetchMock.mockResolvedValueOnce(mockFetchResponse(200, []));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result).toBe(false);
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

        expect(result).toBe(true);
    });

    test('returns true when user is not found', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, []))
            .mockResolvedValueOnce(mockFetchResponse(200, {}));

        const result = await manager.removeUserWithEmailFromGroup(TEST_EMAIL, GROUP_ID);

        expect(result).toBe(true);
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
        expect(url).toBe(`${BASE_URL}/admin/users/list/active.json?email=${TEST_EMAIL}`);
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

        expect(result).toBe(false);
    });

    test('returns false on network error during group update', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockRejectedValueOnce(new Error('Network error'));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result).toBe(false);
    });

    test('returns false when group update returns non-200 status', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(403));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result).toBe(false);
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

        expect(result).toBe(true);
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

        expect(result).toBe(false);
    });

    test('returns false on network error', async () => {
        fetchMock.mockRejectedValueOnce(new Error('Network error'));

        const result = await manager.inviteUserByEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result).toBe(false);
    });
});

describe('retry behavior', () => {
    test('retries on 429 and succeeds on second attempt', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(429))
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(200));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    test('retries on 503 and succeeds on second attempt', async () => {
        fetchMock
            .mockResolvedValueOnce(mockFetchResponse(503))
            .mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]))
            .mockResolvedValueOnce(mockFetchResponse(200));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    test('returns false after exhausting retries on 429', async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(429));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result).toBe(false);
        expect(fetchMock).toHaveBeenCalledTimes(6);
    }, 10000);

    test('does not retry on non-retryable error status', async () => {
        fetchMock.mockResolvedValueOnce(mockFetchResponse(200, [{ username: TEST_USERNAME }]));
        fetchMock.mockResolvedValueOnce(mockFetchResponse(500));

        const result = await manager.addUserWithEmailToGroup(TEST_EMAIL, GROUP_ID);

        expect(result).toBe(false);
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

        expect(result).toBe(true);
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

        expect(result).toBe(true);
    });
});
