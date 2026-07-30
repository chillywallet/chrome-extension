import ContactsController from '../../src/controller/ContactsController';

describe('ContactsController', () => {
    it('initializes with default empty state', () => {
        const c = new ContactsController({ state: {} as any });
        expect(c.store.getState().contacts).toEqual([]);
        expect(c.store.getState().recentContacts).toEqual([]);
    });

    it('merges options state over defaults', () => {
        const initial: any = { contacts: [{ id: '1' }] };
        const c = new ContactsController({ state: initial });
        expect(c.store.getState().contacts).toHaveLength(1);
    });

    it('setContacts updates contacts list', () => {
        const c = new ContactsController({ state: {} as any });
        const contacts: any = [{ name: 'A' }, { name: 'B' }];
        c.setContacts(contacts);
        expect(c.store.getState().contacts).toEqual(contacts);
    });

    it('setRecentContacts updates recent list', () => {
        const c = new ContactsController({ state: {} as any });
        const contacts: any = [{ name: 'R' }];
        c.setRecentContacts(contacts);
        expect(c.store.getState().recentContacts).toEqual(contacts);
    });
});
