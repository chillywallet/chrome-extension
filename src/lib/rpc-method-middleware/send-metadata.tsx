import { SubjectType } from '@metamask/permission-controller';
import { ethErrors } from 'eth-rpc-errors';
import { MESSAGE_TYPE } from '../../shared/constants/app';

/**
 * This internal method is used by our external provider to send metadata about
 * permission subjects so that we can e.g. display a proper name and icon in
 * our UI.
 */

const sendMetadata = {
    methodNames: [MESSAGE_TYPE.SEND_METADATA],
    implementation: sendMetadataHandler,
    hookNames: {
        addSubjectMetadata: true,
        subjectType: true,
    },
};
export default sendMetadata;

function sendMetadataHandler(
    req: any,
    res: any,
    _next: Function,
    end: Function,
    { addSubjectMetadata, subjectType }: { addSubjectMetadata: Function; subjectType: SubjectType },
) {
    const { origin, params } = req;
    if (params && typeof params === 'object' && !Array.isArray(params)) {
        const { icon = null, name = null, ...remainingParams } = params;

        addSubjectMetadata({
            ...remainingParams,
            iconUrl: icon,
            name,
            subjectType,
            origin,
        });
    } else {
        return end(ethErrors.rpc.invalidParams({ data: params }));
    }

    res.result = true;
    return end();
}
