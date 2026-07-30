import { ObservableStore } from '@metamask/obs-store';
import { Contact } from '../api/graphQL/Types';

export type ContactsControllerState = {
    contacts: Contact[];
    recentContacts: Contact[];
};

const defaultState: ContactsControllerState = {
    contacts: [],
    recentContacts: [],
};

type Props = {
    state: ContactsControllerState;
};

export default class ContactsController {
    store: ObservableStore<ContactsControllerState>;

    constructor(opts: Props) {
        const initState = {
            ...defaultState,
            ...opts.state,
        };

        this.store = new ObservableStore(initState);
    }

    setContacts(contacts: Contact[]) {
        this.store.updateState({
            contacts,
        });
    }

    setRecentContacts(contacts: Contact[]) {
        this.store.updateState({
            recentContacts: contacts,
        });
    }
}
