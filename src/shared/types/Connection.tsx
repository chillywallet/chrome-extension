export type BackgroundConnection = {
    connectionStream: { readable: boolean };
    DisconnectError: typeof Error;
} & Record<string, (...args: any[]) => any>;

export type ConnectedSite = {
    extensionId: string | null;
    origin: string;
    name: string | null;
    iconUrl: string | null;
};

export enum DeeplinkType {
    login = 'login', // Open Login screen
    market = 'market', // Open Market screen
    trade = 'trade', // [Deprecated] Open Explore screen
    explore = 'explore', // Open Explore screen
    detail = 'detail', // Open Coin Details screen
    portfolio = 'portfolio', // Open Portfolio screen - Combined Tab
    portfoliocombined = 'portfoliocombined', // Open Portfolio screen - Combined Tab
    portfoliocoins = 'portfoliocoins', // Open Portfolio screen - Coins Tab
    portfolionfts = 'portfolionfts', // Open Portfolio screen - NFTs Tab
    import = 'import', // Open Import Portfolio screen
    importportfolio = 'importportfolio', // Open Import Portfolio screen
    importwallet = 'importwallet', // Open Choose Cryptocurrency screen
    importexchange = 'importexchange', // Open Import from Exchange screen
    karma = 'karma', // Open Quests screen (Onboarding Checklist)
    alert = 'alert', // [Deprecated] Open Price Alerts screen
    schedule = 'schedule', // Open Schedule screen
    learn = 'learn', // Open Learn/Articles screen
    transactions = 'transactions', // Open Transaction History screen
    chat = 'chat', // Open Live Chat screen
    referral = 'referral', // Open Referral screen
    unitconverter = 'unitconverter', // Open Unit Converter screen
    faq = 'faq', // Open FAQ screen
    settings = 'settings', // Open Settings screen
    widgetconfig = 'widgetconfig', // Open Widget Configuration screen
    changepassword = 'changepassword', // Open Change Password screen
    contacthelp = 'contacthelp', // Open Contact, Help & Support screen
    editprofile = 'editprofile', // Open Edit Profile screen
    assetdetails = 'assetdetails', // Open Asset Details screen
    wallet = 'wallet', // Open Wallet screen
    opensea = 'opensea', // Open Webview screen (backward compatibility)
    browser = 'browser', // Open Webview screen
    sendcoins = 'sendcoins', // Open Send Coins screen
    sendnfts = 'sendnfts', // Open Send NFTs screen
    gasoptions = 'gasoptions', // Open Gas Options screen
    revealseedphrase = 'revealseedphrase', // Open Reveal Seed Phrase screen
    swap = 'swap', // Open Swap Coins screen,
    bridge = 'bridge', // Open Bridge Coins screen
    wc = 'wc', // Handle WalletConnect
    promocodes = 'promocodes', // Open Promo Codes screen. Query: promo_code
    sendcoin = 'sendcoin', // Open Send Coin screen.
    sendnft = 'sendnft', // Open Send Coin screen.
    more = 'more', // Open More screen.
    createportfolioalert = 'createportfolioalert', // Open Create Portfolio Alert screen.
    contacts = 'contacts', // Open Contacts screen.
    automationList = 'automationList', // Open Automation List screen.
    earn = 'earn', // Open Earn screen.
    liquidstaking = 'liquidstaking', // Open Liquid Staking screen.
}
