import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import './SearchableSelect.css';

const SearchableSelect = ({
    options = [],
    value = '',
    onChange,
    placeholder = 'Select option...',
    searchPlaceholder = 'Search...',
    labelKey = 'name',
    valueKey = 'id',
    groupKey = 'type',
    disabled = false,
    clearable = true,
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Reset search when opening/closing
    useEffect(() => {
        if (!isOpen) {
            setSearchTerm('');
        }
    }, [isOpen]);

    const selectedOption = options.find(opt => String(opt[valueKey]) === String(value));

    // Filtered options based on search input
    const filteredOptions = options.filter(opt => {
        const label = String(opt[labelKey] || '').toLowerCase();
        const group = groupKey ? String(opt[groupKey] || '').toLowerCase() : '';
        const query = searchTerm.toLowerCase();
        return label.includes(query) || group.includes(query);
    });

    // Group options if groupKey is specified
    const groupedOptions = React.useMemo(() => {
        if (!groupKey) return { '': filteredOptions };

        const groups = {};
        filteredOptions.forEach(opt => {
            const groupName = opt[groupKey] || 'Other';
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(opt);
        });
        return groups;
    }, [filteredOptions, groupKey]);

    const handleToggle = (e) => {
        e.preventDefault();
        if (disabled) return;
        setIsOpen(!isOpen);
    };

    const handleSelect = (optionValue) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        if (disabled) return;
        onChange('');
        setIsOpen(false);
    };

    return (
        <div 
            className={`searchable-select-container ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${className}`}
            ref={containerRef}
        >
            <button
                type="button"
                className="searchable-select-trigger"
                onClick={handleToggle}
                disabled={disabled}
            >
                <span className={`searchable-select-value ${!selectedOption ? 'is-placeholder' : ''}`}>
                    {selectedOption ? selectedOption[labelKey] : placeholder}
                </span>
                <span className="searchable-select-actions">
                    {clearable && selectedOption && !disabled && (
                        <span className="searchable-select-clear" onClick={handleClear}>
                            <X size={14} />
                        </span>
                    )}
                    <ChevronDown size={16} className="searchable-select-chevron" />
                </span>
            </button>

            {isOpen && (
                <div className="searchable-select-dropdown">
                    <div className="searchable-select-search-wrapper">
                        <Search size={14} className="searchable-select-search-icon" />
                        <input
                            type="text"
                            className="searchable-select-search-input"
                            placeholder={searchPlaceholder}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    
                    <div className="searchable-select-options-list">
                        {filteredOptions.length === 0 ? (
                            <div className="searchable-select-no-results">No options found</div>
                        ) : (
                            Object.entries(groupedOptions).map(([groupName, items]) => (
                                <div key={groupName} className="searchable-select-group">
                                    {groupName && (
                                        <div className="searchable-select-group-header">
                                            {groupName.toUpperCase()}
                                        </div>
                                    )}
                                    {items.map(opt => {
                                        const optVal = opt[valueKey];
                                        const isSelected = String(optVal) === String(value);
                                        return (
                                            <div
                                                key={optVal}
                                                className={`searchable-select-option ${isSelected ? 'is-selected' : ''}`}
                                                onClick={() => handleSelect(optVal)}
                                            >
                                                <span className="option-label">{opt[labelKey]}</span>
                                                {opt.groupName && opt.groupName !== groupName && (
                                                    <span className="option-subtext">({opt.groupName})</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
