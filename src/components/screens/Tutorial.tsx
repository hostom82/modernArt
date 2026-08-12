import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ArtistSwatch } from '@/art/generateArtwork';
import { ARTIST_DEFS, AUCTION_TYPE_ICON, AUCTION_TYPE_LABEL } from '@/data/artists';
import { ARTIST_ORDER } from '@/types/game';
import { useGameStore } from '@/store/gameStore';
import { cx } from '@/utils/format';

interface Step {
  title: string;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    title: '你既是买家，也是庄家',
    body: (
      <div className="space-y-3">
        <p>
          每位玩家手里都有一叠画作。轮到你时打出一张，
          这幅画就被推上拍卖台，而<strong className="text-gold">你是拍卖师</strong>——
          别人付的钱进你口袋。
        </p>
        <p>
          但这里有个陷阱：你卖掉画拿到的现金是<strong className="text-cream">立刻的</strong>，
          而画作的价值要到<strong className="text-cream">轮次结束</strong>才揭晓。
        </p>
        <div className="rounded-md border-l-2 border-gold bg-gold/5 px-3 py-2 text-[13px] text-cream/85">
          起始资金 €100k，四轮之后现金最多的人获胜。
        </div>
      </div>
    ),
  },
  {
    title: '价格由「被拍卖的次数」决定',
    body: (
      <div className="space-y-3">
        <p>
          轮次结束时，统计本轮每位艺术家<strong className="text-gold">被打出过多少幅</strong>，
          取前三名加价：
        </p>
        <div className="flex gap-2">
          {[
            { r: '第一名', v: '+30k', c: '#C9A227' },
            { r: '第二名', v: '+20k', c: '#9AA0A6' },
            { r: '第三名', v: '+10k', c: '#A0714A' },
          ].map((x) => (
            <div
              key={x.r}
              className="flex-1 rounded-md border border-line/60 bg-ink/50 px-3 py-2.5 text-center"
            >
              <div className="text-[11px] text-muted">{x.r}</div>
              <div className="font-mono text-lg font-bold" style={{ color: x.c }}>
                {x.v}
              </div>
            </div>
          ))}
        </div>
        <p>
          <strong className="text-cream">加价是累计的。</strong>
          第一轮拿了第一名（30k），第二轮又拿第一名（+30k），
          第二轮就按 <span className="font-mono text-gold">60k</span> 一幅结算。
        </p>
        <p className="text-[13px] text-muted">
          第四名和第五名？本轮一分钱不值——买了他们的画等于打水漂。
        </p>
      </div>
    ),
  },
  {
    title: '这就是全部的策略张力',
    body: (
      <div className="space-y-3">
        <p>假设你手上有 4 幅米娅·凯尔的画。你会想把她推上第一名，让手里的画都值 30k。</p>
        <p>
          于是你不停打出她的作品。可每打出一张，<strong className="text-cream">别人也在低价捡她的画</strong>，
          你抬轿子，别人坐轿子。
        </p>
        <p>
          反过来，如果有人正在猛推某位艺术家，你可以<strong className="text-gold">高价截胡</strong>
          他的画——反正结算时能卖回去。
        </p>
        <div className="rounded-md border-l-2 border-gold bg-gold/5 px-3 py-2 text-[13px] text-cream/85">
          买得太贵会亏，买得太少赚不到，推得太猛是给别人做嫁衣。
        </div>
      </div>
    ),
  },
  {
    title: '五种拍卖方式',
    body: (
      <div className="space-y-2">
        <p className="mb-3 text-[13px] text-muted">每张牌左下角的符号决定了它的拍卖方式。</p>
        {(
          [
            ['OPEN', '所有人自由加价，倒计时归零落槌。最刺激也最容易上头。'],
            ['ONE_OFFER', '每人只有一次报价机会，拍卖师最后决定，可一元截胡。'],
            ['HIDDEN', '所有人同时秘密出价，一起揭晓，最高者得。可以出 0。'],
            ['FIXED', '拍卖师定价，逐个询问。没人要？拍卖师自己按这个价买下。'],
            ['DOUBLE', '需要追加同艺术家的第二幅，两幅一起卖，收益由两位拍卖师平分。'],
          ] as const
        ).map(([t, d]) => (
          <div key={t} className="flex items-start gap-3 rounded-md bg-ink/40 px-3 py-2">
            <span className="mt-0.5 w-5 shrink-0 text-center text-base text-gold">
              {AUCTION_TYPE_ICON[t]}
            </span>
            <div>
              <div className="text-[13px] font-semibold text-cream">{AUCTION_TYPE_LABEL[t]}</div>
              <div className="text-[12px] leading-snug text-muted">{d}</div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: '第 5 幅：本轮的休止符',
    body: (
      <div className="space-y-3">
        <p>
          当某位艺术家的<strong className="text-gold">第 5 幅作品被打出</strong>，本轮<strong>立即结束</strong>。
        </p>
        <div className="space-y-1.5 rounded-md border border-line/60 bg-ink/50 px-3.5 py-3 text-[13px]">
          <div className="flex gap-2">
            <span className="text-red-400">✕</span>
            <span>这第 5 幅<strong className="text-cream">不进行拍卖</strong>，不归任何人所有</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gold">✓</span>
            <span>但它<strong className="text-cream">计入排名张数</strong>——足以把这位艺术家送上第一名</span>
          </div>
        </div>
        <p>
          所以「什么时候按下休止符」是这个游戏最锋利的决策：
          在你重仓的艺术家领先时收手，别人再想追赶已经来不及了。
        </p>
      </div>
    ),
  },
  {
    title: '认识这五位艺术家',
    body: (
      <div className="space-y-2">
        <p className="mb-3 text-[13px] text-muted">
          张数越少的艺术家越稀缺，也越难冲上前三；张数多的容易走量。
          平手时按 <span className="font-mono text-gold">A &gt; B &gt; C &gt; D &gt; E</span> 决胜。
        </p>
        {ARTIST_ORDER.map((id) => {
          const a = ARTIST_DEFS[id];
          return (
            <div key={id} className="flex items-center gap-3 rounded-md bg-ink/40 p-2">
              <div className="h-14 w-11 shrink-0 overflow-hidden rounded-sm border border-line/60">
                <ArtistSwatch artistId={id} styleFamily={a.styleFamily} className="h-full w-full" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-cream">{a.name}</div>
                <div className="text-[12px]" style={{ color: a.color }}>
                  {a.tagline}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-sm text-cream">{a.totalCards}</div>
                <div className="text-[10px] text-muted">幅</div>
              </div>
            </div>
          );
        })}
      </div>
    ),
  },
];

export function Tutorial() {
  const open = useGameStore((s) => s.showTutorial);
  const setOpen = useGameStore((s) => s.setShowTutorial);
  const [step, setStep] = useState(0);

  const cur = STEPS[step];
  const last = step === STEPS.length - 1;

  function close() {
    setOpen(false);
    setTimeout(() => setStep(0), 250);
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={
        <span className="flex items-baseline gap-2.5">
          <span className="font-mono text-sm text-gold">
            {String(step + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
          </span>
          <span>{cur.title}</span>
        </span>
      }
      footer={
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={cx(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  i === step ? 'bg-gold' : i < step ? 'bg-gold/35' : 'bg-line',
                )}
                aria-label={`第 ${i + 1} 步`}
              />
            ))}
          </div>
          <button
            className="btn-ghost px-3 py-1.5 text-[13px]"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            上一步
          </button>
          {last ? (
            <button className="btn-gold px-4 py-1.5 text-[13px]" onClick={close}>
              开始游戏
            </button>
          ) : (
            <button className="btn-gold px-4 py-1.5 text-[13px]" onClick={() => setStep((s) => s + 1)}>
              下一步
            </button>
          )}
        </div>
      }
    >
      <div key={step} className="min-h-[280px] text-sm leading-relaxed text-cream/85 animate-fadeIn">
        {cur.body}
      </div>
    </Modal>
  );
}
