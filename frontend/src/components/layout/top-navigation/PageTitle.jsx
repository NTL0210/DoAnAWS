export default function PageTitle({ activeChannel, activeView }) {
  let pageTitle = 'Welcome';
  if (activeChannel) {
    pageTitle = '# ' + activeChannel.name;
  } else if (activeView === 'tasks') {
    pageTitle = 'Tasks';
  } else if (activeView === 'analytics') {
    pageTitle = 'Analytics';
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      <h2 className="truncate text-base font-semibold text-[#dbdee1]">{pageTitle}</h2>
      {activeChannel?.description && (
        <>
          <span className="text-[#6d6f78]">|</span>
          <span className="hidden truncate text-sm text-[#6d6f78] md:block">
            {activeChannel.description}
          </span>
        </>
      )}
    </div>
  );
}
