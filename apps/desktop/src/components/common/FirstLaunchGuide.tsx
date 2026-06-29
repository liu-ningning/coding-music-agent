import { useState } from 'react';
import s from '@/styles/layout.module.css';

export function FirstLaunchGuide({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: '欢迎使用 Coding Music Agent',
      desc: '一个面向 AI Coding 用户的沉浸式桌面工作舱。音乐 Agent 会根据你的开发状态自动调节声音环境与界面氛围。',
      action: () => setStep(1),
      label: '下一步',
    },
    {
      title: '音乐已就绪',
      desc: '内置音乐曲库已可用，无需任何授权。当你的开发状态变化时，音乐会自动调整。你也可以稍后连接网易云获取更多曲目。',
      action: () => setStep(2),
      label: '继续',
    },
    {
      title: '准备就绪',
      desc: '一切准备就绪！创建一个 Coding Session，开始你的沉浸式编程体验。音乐 Agent 会默默陪伴你。',
      action: onComplete,
      label: '开始使用',
    },
  ];

  const cur = steps[step];

  return (
    <div className={s.guideOverlay}>
      <div className={s.guideCard}>
        <div className={s.guideSteps}>
          {steps.map((_, i) => (
            <div key={i} className={`${s.guideStepDot} ${i <= step ? s.guideStepDotActive : ''}`} />
          ))}
        </div>
        <h2 className={s.guideTitle}>{cur.title}</h2>
        <p className={s.guideDesc}>{cur.desc}</p>
        <div className={s.guideActions}>
          <button className={s.guidePrimaryBtn} onClick={cur.action}>{cur.label}</button>
        </div>
      </div>
    </div>
  );
}
