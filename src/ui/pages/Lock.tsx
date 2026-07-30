import React, { useEffect } from 'react';
import { FaSpinner } from 'react-icons/fa';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { DEFAULT_ROUTE } from '../../shared/constants/routes';
import { lockApp } from '../../store/actions/uiActions';
import { useIsUnlocked } from '../../store/selectors';

type Props = {};

export default React.memo<Props>((props: Props) => {
    const dispatch = useDispatch();
    const history = useHistory();
    const isUnlocked = useIsUnlocked();

    useEffect(() => {
        if (isUnlocked) {
            dispatch(lockApp());
        } else {
            history.replace(DEFAULT_ROUTE);
        }
    }, [dispatch, history, isUnlocked]);

    return (
        <div className="fixed top-0 left-0 w-screen h-screen bg-black bg-opacity-30 flex justify-center items-center">
            <FaSpinner className="custom-anim-fast text-white text-3xl" />
        </div>
    );
});
