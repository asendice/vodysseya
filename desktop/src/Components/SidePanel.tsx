import React from 'react';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'widgets' | 'logs' | 'settings' | 'preferences';
  setActiveTab: (tab: 'widgets' | 'logs' | 'settings' | 'preferences') => void;
  handleLogout: () => void;
  setWidgetType?: (type: string) => void;
}

const SidePanel: React.FC<SidePanelProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  handleLogout,
  setWidgetType,
}) => {
  const [expandedTab, setExpandedTab] = React.useState<string | null>(null);
  const tabs = [
    {
      key: 'home',
      label: 'Home',
    },
    {
      key: 'widgets',
      label: 'Widgets',
      subTabs: [
        'Add Widget',
        'Manage Widgets',
        'Email',
        'Calendar',
        'Lists',
        'Notes',
        'Tasks',
        'Habits',
      ],
    },
    { key: 'logs', label: 'Logs' },
    { key: 'settings', label: 'Settings' },
    { key: 'preferences', label: 'User Preferences' },
  ];

  return (
    <>
      {/* Overlay for closing */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-20 z-40 transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sliding Panel */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-black text-white z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 flex flex-col gap-4 h-full">
          {tabs.map((tab) => (
            <React.Fragment key={tab.key}>
              <button
                onClick={() => {
                  if (tab.subTabs) {
                    setExpandedTab(expandedTab === tab.key ? null : tab.key);
                  } else {
                    setActiveTab(tab.key as SidePanelProps['activeTab']);
                    onClose();
                  }
                }}
                className={`w-full text-left px-4 py-2  ${
                  activeTab === tab.key ? 'border-b border-white' : 'border-b-2 border-black'
                } hover:border-white/20 transition-all duration-200`}
              >
                {tab.label}
              </button>
              {tab.subTabs && expandedTab === tab.key && (
                <div className="ml-4 flex flex-col gap-2">
                  {tab.subTabs.map((subTab) => (
                    <button
                      key={subTab}
                      onClick={() => {
                        setActiveTab('widgets');
                        if (setWidgetType) setWidgetType(subTab);
                        onClose();
                        setExpandedTab(null);
                      }}
                      className="w-full text-left px-3 py-1 text-sm"
                    >
                      {subTab}
                    </button>
                  ))}
                </div>
              )}
            </React.Fragment>
          ))}
          <button onClick={handleLogout} className="mt-auto w-full text-left px-4 py-2">
            Logout
          </button>
        </div>
      </div>
    </>
  );
};

export default SidePanel;
