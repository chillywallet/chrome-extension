import * as app from '../../../src/shared/constants/app';
import * as common from '../../../src/shared/constants/common';
import * as network from '../../../src/shared/constants/network';
import * as notifications from '../../../src/shared/constants/notifications';
import * as number from '../../../src/shared/constants/number';
import * as permissions from '../../../src/shared/constants/permissions';
import * as routes from '../../../src/shared/constants/routes';
import * as stream from '../../../src/shared/constants/stream';
import * as swap from '../../../src/shared/constants/swap';

describe('shared/constants', () => {
    it('app exposes environment constants', () => {
        expect(app.ENVIRONMENT_TYPE_POPUP).toBe('popup');
        expect(app.ENVIRONMENT_TYPE_FULLSCREEN).toBe('fullscreen');
        expect(app.ENVIRONMENT_TYPE_BACKGROUND).toBe('background');
        expect(app.ENVIRONMENT_TYPE_NOTIFICATION).toBe('notification');
        expect(app.ENVIRONMENT_TYPE_SIDEPANEL).toBe('sidepanel');
    });

    it('app exposes platform constants', () => {
        expect(app.PLATFORM_BRAVE).toBe('Brave');
        expect(app.PLATFORM_CHROME).toBe('Chrome');
        expect(app.PLATFORM_EDGE).toBe('Edge');
        expect(app.PLATFORM_FIREFOX).toBe('Firefox');
        expect(app.PLATFORM_OPERA).toBe('Opera');
    });

    it('app exposes MESSAGE_TYPE map', () => {
        expect(app.MESSAGE_TYPE.ETH_CHAIN_ID).toBe('eth_chainId');
        expect(app.MESSAGE_TYPE.ETH_REQUEST_ACCOUNTS).toBe('eth_requestAccounts');
        expect(app.MESSAGE_TYPE.PERSONAL_SIGN).toBe('personal_sign');
    });

    it('app exposes timing/url/oauth constants', () => {
        expect(app.UI_DELAY_INTERNAL).toBe(2000);
        expect(app.ANIM_DURATION).toBe(0.3);
        expect(app.REMOTE_CONFIG_CACHE_INTERVAL).toBe(60000);
    });

    it('common exposes prerender browser version maps', () => {
        expect(common.BROKEN_PRERENDER_BROWSER_VERSIONS.chrome).toBe('>=113');
        expect(common.FIXED_PRERENDER_BROWSER_VERSIONS.chrome).toBe('>=121');
        expect(common.FIXED_PRERENDER_BROWSER_VERSIONS.windows.chrome).toBe('>=120');
        expect(common.PENDING_TX_EXPIRED_TIME).toBe(7);
    });

    it('network exposes USD_COIN, MAX_TOKEN_ALLOWANCE, etc.', () => {
        expect(network.USD_COIN.symbol).toBe('USD');
        expect(network.MAX_TOKEN_ALLOWANCE).toMatch(/^\d+$/);
        expect(network.EVM_NATIVE_TOKEN_ADDRESS).toBe(
            '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        );
        expect(network.UNSUPPORTED_RPC_METHODS.has('eth_signTransaction')).toBe(true);
        expect(network.POLYGON_NATIVE_TOKEN_ADDRESS).toBe(
            '0x0000000000000000000000000000000000001010',
        );
    });

    it('notifications exposes window dimensions', () => {
        expect(notifications.NOTIFICATION_HEIGHT).toBe(620);
        expect(notifications.NOTIFICATION_WIDTH).toBe(360);
    });

    it('number exposes numeric constants', () => {
        expect(number.TEN_SECONDS_IN_MILLISECONDS).toBe(10000);
        expect(number.RECENT_CONTACTS_LIMIT).toBe(5);
        expect(number.PAGING_LIMIT).toBe(30);
        expect(number.KARMA_PER_CHECKIN).toBe(10);
    });

    it('permissions exposes CaveatTypes and RestrictedMethods', () => {
        expect(permissions.CaveatTypes.restrictReturnedAccounts).toBe(
            'restrictReturnedAccounts',
        );
        expect(permissions.RestrictedMethods.eth_accounts).toBe('eth_accounts');
    });

    it('routes exposes a variety of route constants', () => {
        expect(routes.ONBOARDING_ROUTE).toBe('/onboarding');
        expect(routes.DEFAULT_ROUTE).toBe('/');
        expect(routes.UNLOCK_ROUTE).toBe('/unlock');
        expect(routes.SWAP_ROUTE).toBe('/swap');
        expect(routes.SEND_ASSET_ROUTE).toBe('/send-asset');
        expect(routes.EARN_ROUTE).toBe('/earn');
    });

    it('stream exposes channel, context names, and PING_INTERVAL', () => {
        expect(stream.CONTROLLER).toBe('controller');
        expect(stream.CONTENT_SCRIPT).toBe('chilly-contentscript');
        expect(stream.INPAGE).toBe('chilly-inpage');
        expect(stream.EXTERNAL_PROVIDER).toBe('chilly-provider');
        expect(stream.INTERNAL_PROVIDER).toBe('provider');
        expect(stream.PING_INTERVAL).toBe(3000);
    });

    it('swap exposes default values', () => {
        expect(swap.GAS_PERCENTAGE).toBe(0.8);
        expect(swap.DEFAULT_SLIPPAGE).toBe(0.5);
        expect(swap.MIN_SLIPPAGE).toBe(0.01);
        expect(swap.MAX_SLIPPAGE).toBe(50);
        expect(swap.UPDATE_GAS_INTERVAL).toBe(60000);
        expect(swap.UNIT_256_MAX_VALUE).toMatch(/^\d+$/);
    });
});
