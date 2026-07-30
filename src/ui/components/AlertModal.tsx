import React, { useEffect, useState } from 'react';
import EventType from '../../shared/types/EventType';
import { AlertModalData } from '../../shared/types/Global';
import eventManager from '../../shared/utils/eventManager';
import Header from './Header';
import Modal from './Modal';

type Props = {};

export default React.memo<Props>((props: Props) => {
    const [visible, setVisible] = useState(false);
    const [{ title, message, buttons, closable = true, isHtml = false }, setAlertData] = useState<AlertModalData>({});

    useEffect(() => {
        const cb = (args: AlertModalData) => {
            setAlertData(args);
            setVisible(true);
        };
        eventManager.on(EventType.SHOW_ALERT_MODAL, cb);

        return () => {
            eventManager.off(EventType.SHOW_ALERT_MODAL, cb);
        };
    }, []);

    return (
        <Modal
            visible={visible}
            onClose={() => {
                if (closable) {
                    setVisible(false);
                }
            }}>
            <Header title={title ?? ''} hasBackButton={false} />
            <div className="divide-y dark:divide-darker flex-1 max-h-[55vh] overflow-auto py-3 px-5">
                {message && isHtml && (
                    <p className="text-sm text-black dark:text-white break-words" dangerouslySetInnerHTML={{ __html: message }} />
                )}
                {message && !isHtml && <p className="text-sm text-black dark:text-white break-words">{message}</p>}
            </div>
            <div className="px-5 pb-5 dark:text-white" id='alert-modal'>
                {buttons && buttons.length > 0 ? (
                    buttons.map((_button, index) => {
                        return (
                            <button
                                key={index}
                                className={
                                    _button.type === 'cancel'
                                        ? 'btn w-full mt-3'
                                        : 'btn btn-primary w-full mt-3'
                                }
                                onClick={e => {
                                    e.preventDefault();
                                    setVisible(false);
                                    _button.onPress && _button.onPress();
                                }}>
                                {_button.name}
                            </button>
                        );
                    })
                ) : (
                    <button
                        className="btn w-full mt-3"
                        onClick={e => {
                            e.preventDefault();
                            setVisible(false);
                        }}>
                        Close
                    </button>
                )}
            </div>
        </Modal>
    );
});
