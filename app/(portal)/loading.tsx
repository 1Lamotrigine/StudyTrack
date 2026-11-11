export default function Loading() {
  return (
    <div role="status" aria-label="Загружаем страницу">
      <div className="skeleton" style={{ width: '45%', minHeight: 40 }} />
      <div className="skeleton" style={{ minHeight: 170 }} />
      <div className="stats">
        {[1, 2, 3, 4].map((n) => (
          <div className="skeleton" key={n} />
        ))}
      </div>
      <div className="skeleton" style={{ minHeight: 250 }} />
    </div>
  );
}
