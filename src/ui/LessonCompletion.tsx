import './lesson-completion.css';

export default function LessonCompletion({ title, introduction, summaryTitle, summary, detail, nextLesson, onRestart, onSaveReport, reportButtonLabel }: {
  title: string;
  introduction: string;
  summaryTitle: string;
  summary: string;
  detail?: string;
  nextLesson: string;
  onRestart: () => void;
  onSaveReport?: () => void;
  reportButtonLabel?: string;
}) {
  return <section className="lesson-completion" aria-label="차시 정리 완료">
    <div className="lesson-completion-mark" aria-hidden="true">✓</div>
    <h2>{title}</h2>
    <p className="lesson-completion-intro">{introduction}</p>
    <div className="lesson-completion-summary">
      <b>{summaryTitle}</b>
      <p>{summary}</p>
      {detail && <small>{detail}</small>}
    </div>
    <div className="lesson-completion-preview">
      <b>다음 차시</b>
      <p>{nextLesson}</p>
    </div>
    {onSaveReport && <button className="lesson-completion-report" onClick={onSaveReport}>{reportButtonLabel ?? '탐구 보고서 PDF 저장'}</button>}
    <button className="lesson-completion-restart" onClick={onRestart}>처음부터 다시하기</button>
  </section>;
}
