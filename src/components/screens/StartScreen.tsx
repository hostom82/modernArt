import { useState } from 'react';
import type { AiLevel } from '@/types/game';
import { ARTIST_DEFS } from '@/data/artists';
import { ArtistSwatch } from '@/art/generateArtwork';
import { AI_PROFILES } from '@/ai';
import { useGameStore } from '@/store/gameStore';
import { cx } from '@/utils/format';

const AI_LEVELS: AiLevel[] = ['easy', 'normal', 'hard'];

export function StartScreen() {
  const newGame = useGameStore((s) => s.newGame);
  const createRoom = useGameStore((s) => s.createRoom);
  const joinRoom = useGameStore((s) => s.joinRoom);
  const setShowRules = useGameStore((s) => s.setShowRules);
  const setShowTutorial = useGameStore((s) => s.setShowTutorial);

  const [tab, setTab] = useState<'local' | 'online'>('local');

  // 单机设置
  const [playerCount, setPlayerCount] = useState(4);
  const [humanCount, setHumanCount] = useState(1);
  const [aiLevel, setAiLevel] = useState<AiLevel>('normal');
  const [names, setNames] = useState<string[]>(['你', '玩家二', '玩家三', '玩家四', '玩家五']);
  const [seedText, setSeedText] = useState('');
  const humans = Math.min(humanCount, playerCount);

  // 联机设置
  const [onlineName, setOnlineName] = useState('你');
  const [onlineCount, setOnlineCount] = useState(4);
  const [onlineLevel, setOnlineLevel] = useState<AiLevel>('normal');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('你');

  function setCount(n: number) {
    setPlayerCount(n);
    if (humanCount > n) setHumanCount(n);
  }

  function setName(i: number, v: string) {
    setNames((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  }

  function startLocal() {
    const seed = seedText.trim() ? Number(seedText.trim()) : undefined;
    newGame({
      playerCount,
      humanCount: humans,
      aiLevel,
      names: names.slice(0, playerCount).map((n, i) => n.trim() || `玩家${i + 1}`),
      seed: Number.isFinite(seed) ? seed : undefined,
    });
  }

  return (
    <div className="scroll-soft min-h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col justify-center px-5 py-10">
        {/* 标题 */}
        <header className="mb-9 text-center animate-fadeUp">
          <div className="mb-3 flex items-center justify-center gap-3">
            {(Object.keys(ARTIST_DEFS) as (keyof typeof ARTIST_DEFS)[]).map((id) => (
              <div
                key={id}
                className="h-12 w-9 overflow-hidden rounded-sm border border-line/60 shadow-lg
                  transition-transform duration-300 hover:-translate-y-1 sm:h-16 sm:w-12"
              >
                <ArtistSwatch
                  artistId={id}
                  styleFamily={ARTIST_DEFS[id].styleFamily}
                  className="h-full w-full"
                />
              </div>
            ))}
          </div>
          <h1 className="brush-title text-4xl font-bold tracking-tight text-cream sm:text-5xl">
            现代艺术
          </h1>
          <p className="mt-1 text-sm uppercase tracking-[0.42em] text-gold">Modern Art</p>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted">
            五位艺术家，四轮拍卖。你既是买家也是庄家——
            <br className="hidden sm:block" />
            你抬高的，正是自己手里那批画的价格。
          </p>
        </header>

        {/* 模式切换 */}
        <div className="mx-auto mb-4 flex w-full max-w-2xl gap-2">
          {(['local', 'online'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cx(
                'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition',
                tab === t
                  ? 'border-gold bg-gold/15 text-gold'
                  : 'border-line/70 text-cream/80 hover:border-gold/50',
              )}
            >
              {t === 'local' ? '单机对战' : '联机对战'}
            </button>
          ))}
        </div>

        {/* 单机设置 */}
        {tab === 'local' && (
          <div className="panel mx-auto w-full max-w-2xl p-5 animate-fadeUp sm:p-6">
            <Field label="参与人数">
              <div className="flex gap-2">
                {[3, 4, 5].map((n) => (
                  <Choice key={n} active={playerCount === n} onClick={() => setCount(n)}>
                    {n} 人
                  </Choice>
                ))}
              </div>
            </Field>

            <Field label="真人玩家" hint="其余席位由 AI 接管，可多人同屏轮流操作">
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: playerCount }, (_, i) => i + 1).map((n) => (
                  <Choice key={n} active={humans === n} onClick={() => setHumanCount(n)}>
                    {n} 人
                  </Choice>
                ))}
              </div>
            </Field>

            <Field label="AI 难度">
              <div className="grid gap-2 sm:grid-cols-3">
                {AI_LEVELS.map((id) => {
                  const lv = AI_PROFILES[id];
                  return (
                    <button
                      key={id}
                      onClick={() => setAiLevel(id)}
                      className={cx(
                        'rounded-lg border px-3 py-2.5 text-left transition',
                        aiLevel === id ? 'border-gold bg-gold/10' : 'border-line/70 hover:border-gold/50 hover:bg-slate2/50',
                      )}
                    >
                      <div className={cx('text-sm font-semibold', aiLevel === id ? 'text-gold' : 'text-cream')}>
                        {lv.label}
                      </div>
                      <div className="mt-0.5 text-[11px] leading-snug text-muted">{lv.desc}</div>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="玩家名称">
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: playerCount }, (_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className={cx(
                        'w-11 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold',
                        i < humans ? 'bg-gold/20 text-gold' : 'bg-slate2 text-muted',
                      )}
                    >
                      {i < humans ? '真人' : 'AI'}
                    </span>
                    <input
                      value={names[i]}
                      onChange={(e) => setName(i, e.target.value)}
                      maxLength={10}
                      className="w-full rounded-md border border-line/70 bg-ink/60 px-2.5 py-1.5 text-sm text-cream outline-none transition focus:border-gold/70"
                    />
                  </div>
                ))}
              </div>
            </Field>

            <Field label="随机种子" hint="留空则每局随机；填入相同数字可复现同一副牌">
              <input
                value={seedText}
                onChange={(e) => setSeedText(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="可选，例如 20260811"
                className="w-full rounded-md border border-line/70 bg-ink/60 px-3 py-2 font-mono text-sm text-cream outline-none transition placeholder:text-muted/60 focus:border-gold/70"
              />
            </Field>

            <button className="btn-gold mt-5 w-full py-3 text-base" onClick={startLocal}>
              开始拍卖
            </button>
          </div>
        )}

        {/* 联机设置 */}
        {tab === 'online' && (
          <div className="panel mx-auto w-full max-w-2xl space-y-5 p-5 animate-fadeUp sm:p-6">
            {/* 创建房间 */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                创建房间
              </div>
              <Field label="房间人数（含你 + AI 补满）">
                <div className="flex gap-2">
                  {[3, 4, 5].map((n) => (
                    <Choice key={n} active={onlineCount === n} onClick={() => setOnlineCount(n)}>
                      {n} 人
                    </Choice>
                  ))}
                </div>
              </Field>
              <Field label="AI 难度">
                <div className="flex flex-wrap gap-2">
                  {AI_LEVELS.map((id) => (
                    <Choice key={id} active={onlineLevel === id} onClick={() => setOnlineLevel(id)}>
                      {AI_PROFILES[id].label}
                    </Choice>
                  ))}
                </div>
              </Field>
              <Field label="你的昵称">
                <input
                  value={onlineName}
                  onChange={(e) => setOnlineName(e.target.value)}
                  maxLength={10}
                  className="w-full rounded-md border border-line/70 bg-ink/60 px-3 py-2 text-sm text-cream outline-none transition focus:border-gold/70"
                />
              </Field>
              <button
                className="btn-gold mt-1 w-full py-2.5"
                onClick={() => createRoom({ playerCount: onlineCount, aiLevel: onlineLevel, name: onlineName })}
              >
                创建并进入大厅
              </button>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-muted/70">
              <span className="h-px flex-1 bg-line/60" />
              或
              <span className="h-px flex-1 bg-line/60" />
            </div>

            {/* 加入房间 */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                加入房间
              </div>
              <Field label="房间号">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  maxLength={4}
                  placeholder="4 位房间号"
                  className="w-full rounded-md border border-line/70 bg-ink/60 px-3 py-2 font-mono text-sm tracking-[0.3em] text-cream outline-none transition placeholder:text-muted/60 focus:border-gold/70"
                />
              </Field>
              <Field label="你的昵称">
                <input
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  maxLength={10}
                  className="w-full rounded-md border border-line/70 bg-ink/60 px-3 py-2 text-sm text-cream outline-none transition focus:border-gold/70"
                />
              </Field>
              <button
                className="btn-ghost w-full py-2.5"
                disabled={joinCode.length !== 4}
                onClick={() => joinRoom(joinCode, joinName)}
              >
                加入房间
              </button>
            </div>
          </div>
        )}

        <div className="mx-auto mt-3 flex w-full max-w-2xl gap-2">
          <button className="btn-ghost flex-1" onClick={() => setShowTutorial(true)}>
            新手教程
          </button>
          <button className="btn-ghost flex-1" onClick={() => setShowRules(true)}>
            完整规则
          </button>
        </div>

        <p className="mx-auto mt-6 max-w-lg text-center text-[11px] text-muted/70">
          所有画作均由算法即时生成 · 每人起始资金 €100k
          <br />
          {import.meta.env.VITE_PARTYKIT_HOST
            ? '联机服务器已就绪，创建/加入房间即可同局对战'
            : '联机需先启动服务器（npm run dev:server）或在构建时配置 VITE_PARTYKIT_HOST'}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</span>
        {hint && <span className="text-[11px] text-muted/70">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'min-w-[64px] rounded-lg border px-3.5 py-2 text-sm font-medium transition',
        active
          ? 'border-gold bg-gold/15 text-gold'
          : 'border-line/70 text-cream/80 hover:border-gold/50 hover:bg-slate2/50',
      )}
    >
      {children}
    </button>
  );
}
