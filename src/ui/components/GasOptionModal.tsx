import React from 'react';
import { GasInfo, GasType } from '../../shared/types/Wallet';
import GasOptionContent from './GasOptionContent';
import Header from './Header';
import Modal from './Modal';

type Props = {
    visible: boolean;
    gasLimit?: number;
    suggestionGas?: GasInfo;
    onClosePress: () => void;
    initGasType?: GasType;
};

export default React.memo<Props>((props: Props) => {
    const {
        visible,
        onClosePress,
        suggestionGas,
        gasLimit = 21000,
        initGasType,
    } = props;

    return (
        <Modal
            visible={visible}
            onClose={() => {
                onClosePress();
            }}>
            <Header title="Edit Network Fee" hasBackButton={false} onClosePress={onClosePress} />
            <div className="max-h-[70vh] overflow-y-auto">
                <GasOptionContent
                    gasLimit={gasLimit}
                    suggestionGas={suggestionGas}
                    initGasType={initGasType}
                    initExpanded={initGasType === GasType.Custom}
                />

            </div>
        </Modal>
    );
});
