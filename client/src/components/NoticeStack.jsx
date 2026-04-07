export default function NoticeStack({ notices, onDismiss }) {
  return (
    <div className="notice-stack">
      {notices.map((notice) => (
        <div key={notice.id} className={`notice notice-${notice.type}`}>
          <div>
            <strong>{notice.title}</strong>
            <p>{notice.message}</p>
          </div>
          <button type="button" onClick={() => onDismiss(notice.id)}>
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
