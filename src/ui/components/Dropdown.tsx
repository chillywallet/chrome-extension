import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

export interface DropdownOption {
    value: string;
    label: string;
    subLabel?: string;
    icon?: React.ReactNode;
    badge?: string;
    disabled?: boolean;
    isLoading?: boolean;
    rightContent?: React.ReactNode;
}

interface DropdownProps {
    options: DropdownOption[];
    value?: string;
    placeholder?: string;
    onChange: (value: string, option: DropdownOption) => void;
    disabled?: boolean;
    className?: string;
    buttonClassName?: string;
    optionsClassName?: string;
    maxHeight?: string;
    searchable?: boolean;
    onSearch?: (query: string) => void;
    usePortal?: boolean;
}

export default React.memo<DropdownProps>((props: DropdownProps) => {
    const {
        options,
        value,
        placeholder = 'Select an option',
        onChange,
        disabled = false,
        className = '',
        buttonClassName = '',
        optionsClassName = '',
        maxHeight = 'max-h-60',
        searchable = false,
        onSearch,
    } = props;

    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [portalStyle, setPortalStyle] = useState<{
        top: number;
        left: number;
        width: number;
    } | null>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);

    const selectedOption = options.find(option => option.value === value);

    const filteredOptions =
        searchable && searchQuery
            ? options.filter(
                  option =>
                      option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      option.subLabel?.toLowerCase().includes(searchQuery.toLowerCase()),
              )
            : options;

    const handleOptionClick = useCallback(
        (option: DropdownOption) => {
            if (option.disabled) return;
            onChange(option.value, option);
            setIsOpen(false);
            setSearchQuery('');
        },
        [onChange],
    );

    const handleSearchChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const query = e.target.value;
            setSearchQuery(query);
            onSearch?.(query);
        },
        [onSearch],
    );

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isOpen) {
                const target = event.target as Element;
                if (!target.closest('[data-dropdown]')) {
                    setIsOpen(false);
                    setSearchQuery('');
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Position portal menu to overflow modal boundaries
    useLayoutEffect(() => {
        if (!isOpen) return;
        const el = buttonRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        setPortalStyle({
            top: rect.bottom + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
        });
    }, [isOpen]);

    const OptionsList = useMemo(
        () => (
            <div
                className={`bg-white dark:bg-header text-gray-900 dark:text-white border border-slate-200 dark:border-darkline/60 rounded-xl shadow-xl ${maxHeight} overflow-y-auto ${optionsClassName}`}
                style={{ width: '100%' }}>
                {/* Search Input */}
                {searchable && (
                    <div className="p-2 border-b border-slate-100 dark:border-darkline/40">
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={handleSearchChange}
                            className="w-full p-2 text-sm border border-slate-200 dark:border-darkline rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-accent"
                            onClick={e => e.stopPropagation()}
                        />
                    </div>
                )}

                {/* Options List */}
                {filteredOptions.length > 0 ? (
                    filteredOptions.map((option, index) => (
                        <button
                            key={index}
                            onClick={() => handleOptionClick(option)}
                            disabled={option.disabled}
                            className={`w-full p-3 text-left hover:bg-ice/60 dark:hover:bg-header/70 transition-colors ${
                                option.disabled ? 'opacity-50 cursor-not-allowed' : ''
                            } ${
                                value === option.value ? 'bg-ice/60 dark:bg-header/70' : ''
                            }`}>
                            <div className="flex items-center space-x-3">
                                {option.icon && <div className="flex-shrink-0">{option.icon}</div>}
                                <div className="flex flex-col flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-sm truncate">
                                            {option.label}
                                        </span>
                                        {option.badge && (
                                            <span className="text-xs bg-ice dark:bg-header/70 text-sky-800 dark:text-accent px-2 py-1 rounded ml-2 flex-shrink-0">
                                                {option.badge}
                                            </span>
                                        )}
                                    </div>
                                    {option.subLabel && (
                                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                            {option.subLabel}
                                        </span>
                                    )}
                                </div>
                                {option.rightContent && (
                                    <div
                                        className={`flex-shrink-0 ml-2 ${
                                            option.isLoading ? 'animate-pulse' : ''
                                        }`}>
                                        {option.rightContent}
                                    </div>
                                )}
                            </div>
                        </button>
                    ))
                ) : (
                    <div className="p-3 text-center text-gray-500 dark:text-gray-400 text-sm">
                        {searchQuery ? 'No results found' : 'No options available'}
                    </div>
                )}
            </div>
        ),
        [
            filteredOptions,
            handleOptionClick,
            handleSearchChange,
            maxHeight,
            optionsClassName,
            searchQuery,
            searchable,
            value,
        ],
    );

    return (
        <div className={`relative ${className}`} data-dropdown>
            {/* Dropdown Button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                ref={buttonRef}
                className={`w-full p-3 border border-slate-200 dark:border-darkline rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary dark:focus:ring-accent dark:focus:border-accent text-left flex items-center justify-between transition-colors ${
                    disabled
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:border-primary/50 dark:hover:border-accent/50'
                } ${buttonClassName}`}>
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {selectedOption?.icon && (
                        <div className="flex-shrink-0">{selectedOption.icon}</div>
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-medium text-sm truncate">
                            {selectedOption?.label || placeholder}
                        </span>
                        {selectedOption?.subLabel && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {selectedOption.subLabel}
                            </span>
                        )}
                    </div>
                    {selectedOption?.badge && (
                        <span className="text-xs bg-ice dark:bg-header/70 text-sky-800 dark:text-accent px-2 py-1 rounded flex-shrink-0 ml-2">
                            {selectedOption.badge}
                        </span>
                    )}
                    {selectedOption?.rightContent && (
                        <div
                            className={`flex-shrink-0 ml-2 ${
                                selectedOption.isLoading ? 'animate-pulse' : ''
                            }`}>
                            {selectedOption.rightContent}
                        </div>
                    )}
                </div>
                <svg
                    className={`ml-2 w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${
                        isOpen ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                    />
                </svg>
            </button>

            {/* Dropdown Options */}
            {isOpen &&
                (props.usePortal !== false && portalStyle ? (
                    ReactDOM.createPortal(
                        <div
                            className="fixed z-[9999]"
                            data-dropdown
                            style={{
                                top: portalStyle.top,
                                left: portalStyle.left,
                                width: portalStyle.width,
                            }}>
                            {OptionsList}
                        </div>,
                        document.body,
                    )
                ) : (
                    <div className={`absolute z-10 w-full mt-1`}>{OptionsList}</div>
                ))}
        </div>
    );
});
