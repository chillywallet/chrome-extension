import React, { useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';

type Props = {
    checked: boolean;
    disabled?: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default React.memo<Props>((props) => {
    const { checked, disabled = false, onChange } = props;

    const [elementId, setElementId] = useState<string>();

    useEffect(() => {
        setElementId(uuid());
    }, []);

    return (
        <label className="relative inline-flex cursor-pointer items-center">
            <input id={"switch-" + elementId}
                type="checkbox"
                disabled={disabled}
                className="peer sr-only"
                checked={checked}
                onChange={onChange}
            />
            <label htmlFor={"switch-" + elementId} className="hidden"></label>
            <div className={"peer h-6 w-11 rounded-full border bg-slate-200 after:absolute after:left-[2px] after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-primary " + (disabled ? "opacity-40" : "")}></div>
        </label>
    );
});