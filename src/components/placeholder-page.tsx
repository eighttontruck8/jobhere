type PlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PlaceholderPage({
  eyebrow,
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <section className="placeholder">
      <p className="placeholder-label">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="placeholder-description">{description}</p>
      <span className="placeholder-status">프로젝트 기반 구성 완료</span>
    </section>
  );
}
