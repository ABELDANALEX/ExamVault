export default function LoadingScreen({ label = 'Loading ExamVault…' }) {
  return (
    <div className="loading-screen">
      <div className="loading-orb" />
      <p>{label}</p>
    </div>
  );
}
