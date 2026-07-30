import axios from 'axios';
import NnsService from '../../src/lib/NnsService';

jest.mock('axios', () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
    },
}));

describe('NnsService', () => {
    beforeEach(() => {
        (axios.get as jest.Mock).mockReset();
    });

    it('getDomainByAddress calls the proper URL', () => {
        (axios.get as jest.Mock).mockResolvedValue({ data: { name: 'foo.nad' } });
        NnsService.getDomainByAddress('0xabc', 143);
        expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining('primary-name/0xabc'),
        );
        expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining('chainId=143'),
        );
    });

    it('getAddressByDomain lowercases the domain', () => {
        (axios.get as jest.Mock).mockResolvedValue({ data: { address: '0xabc' } });
        NnsService.getAddressByDomain('FOO.NAD', 143);
        expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining('resolved-address/foo.nad'),
        );
    });
});
