import { AUCTION_TYPE_DESC, AUCTION_TYPE_ICON, AUCTION_TYPE_LABEL, ARTIST_DEFS } from '@/data/artists';
import { ARTIST_ORDER } from '@/types/game';
import { Accordion } from '@/components/ui/Accordion';
import { Modal } from '@/components/ui/Modal';
import { ArtistSwatch } from '@/art/generateArtwork';
import { useGameStore } from '@/store/gameStore';

export function RulesPage() {
  const open = useGameStore((s) => s.showRules);
  const setOpen = useGameStore((s) => s.setShowRules);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="完整规则" size="lg">
      <div className="space-y-2.5">
        <Accordion title="游戏目标" defaultOpen>
          <p>
            四轮拍卖结束时，<strong className="text-gold">现金最多的人获胜</strong>。
            你在拍卖中买入画作，在轮次结算时按市场价卖回银行。
            关键在于：一位艺术家的价格由<strong className="text-cream">本轮被拍卖的次数</strong>决定，
            而次数由所有玩家共同推动——包括你自己。
          </p>
        </Accordion>

        <Accordion title="回合流程">
          <ol className="ml-4 list-decimal space-y-1.5">
            <li>轮到你时，从手牌打出一张作品，你即成为这幅作品的<strong>拍卖师</strong>。</li>
            <li>按作品左下角标注的方式进行拍卖，所有人（含拍卖师）都可以竞买。</li>
            <li>成交后款项支付给拍卖师；若拍卖师自己拍下，款项<strong>支付给银行</strong>。</li>
            <li>作品放入买家的「本轮收藏」，出牌权顺时针传给下一位。</li>
            <li>
              当某位艺术家<strong className="text-gold">第 5 幅作品被打出</strong>时，本轮立即结束。
              这第 5 幅<strong>不进行拍卖、不归属任何人</strong>，但<strong>计入排名张数</strong>。
            </li>
            <li>所有人手牌耗尽同样会结束本轮。</li>
          </ol>
        </Accordion>

        <Accordion title="五种拍卖方式">
          <div className="space-y-2.5">
            {(['OPEN', 'ONE_OFFER', 'HIDDEN', 'FIXED', 'DOUBLE'] as const).map((t) => (
              <div key={t} className="rounded-md border border-line/60 bg-ink/40 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-base text-gold">{AUCTION_TYPE_ICON[t]}</span>
                  <span className="font-semibold text-cream">{AUCTION_TYPE_LABEL[t]}</span>
                </div>
                <p className="text-[13px] text-cream/75">{AUCTION_TYPE_DESC[t]}</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{DETAIL[t]}</p>
              </div>
            ))}
          </div>
        </Accordion>

        <Accordion title="联合拍卖的细则">
          <ul className="ml-4 list-disc space-y-1.5">
            <li>打出联合拍卖牌后，先问拍卖师本人是否追加同一位艺术家的第二幅作品。</li>
            <li>拍卖师不加，则按顺时针依次询问其他人；手上没有合法牌的会自动跳过。</li>
            <li>
              由别人追加时，他成为<strong className="text-cream">共同拍卖师</strong>，
              成交款<strong>两人平分</strong>（奇数时原拍卖师多拿一元）。
            </li>
            <li>两幅作品作为一个整体成交，胜者<strong>一次拿走两幅</strong>。</li>
            <li>实际拍卖方式由<strong>第二幅</strong>作品决定。</li>
            <li>
              <strong className="text-gold">全员都不追加</strong>：不进行拍卖，
              拍卖师<strong>免费获得</strong>这幅作品。
            </li>
            <li>共同拍卖师自己拍下时，付一半给原拍卖师，另一半给银行。</li>
            <li>之后的出牌权交给<strong>共同拍卖师的左手边</strong>玩家。</li>
          </ul>
        </Accordion>

        <Accordion title="轮次结算">
          <ol className="ml-4 list-decimal space-y-1.5">
            <li>
              统计本轮各艺术家被打出的张数，取前三名，分别<strong className="text-gold">+30 / +20 / +10</strong>。
              张数为 0 的艺术家不占名额。
            </li>
            <li>
              张数相同时，按固定顺序决胜：
              <span className="ml-1 font-mono text-gold">A &gt; B &gt; C &gt; D &gt; E</span>。
            </li>
            <li>
              <strong className="text-cream">价格是累计的</strong>：本轮结算价 = 该艺术家历轮加成之和。
              第一轮拿了 30，第二轮又拿 30，第二轮就按 60 结算。
            </li>
            <li>
              <strong>只有本轮进入前三</strong>的艺术家才能卖钱，其余作品本轮价值为 0。
            </li>
            <li>卖出的画作全部弃掉，未卖出的手牌保留到下一轮。</li>
          </ol>
        </Accordion>

        <Accordion title="发牌张数">
          <table className="w-full text-center text-[13px]">
            <thead className="text-muted">
              <tr>
                <th className="py-1.5 text-left font-medium">人数</th>
                <th className="font-medium">第 1 轮</th>
                <th className="font-medium">第 2 轮</th>
                <th className="font-medium">第 3 轮</th>
                <th className="font-medium">第 4 轮</th>
              </tr>
            </thead>
            <tbody className="font-mono text-cream">
              <tr className="border-t border-line/50">
                <td className="py-1.5 text-left">3 人</td>
                <td>10</td>
                <td>6</td>
                <td>6</td>
                <td>0</td>
              </tr>
              <tr className="border-t border-line/50">
                <td className="py-1.5 text-left">4 人</td>
                <td>9</td>
                <td>4</td>
                <td>4</td>
                <td>0</td>
              </tr>
              <tr className="border-t border-line/50">
                <td className="py-1.5 text-left">5 人</td>
                <td>8</td>
                <td>3</td>
                <td>3</td>
                <td>0</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-[12px] text-muted">
            第 4 轮不再补牌，用完手上剩余的画作即可。手牌为空的玩家跳过出牌，但<strong>仍然可以竞买</strong>。
          </p>
        </Accordion>

        <Accordion title="五位艺术家">
          <div className="space-y-2">
            {ARTIST_ORDER.map((id) => {
              const a = ARTIST_DEFS[id];
              return (
                <div key={id} className="flex items-center gap-3 rounded-md bg-ink/40 p-2">
                  <div className="h-14 w-11 shrink-0 overflow-hidden rounded-sm border border-line/60">
                    <ArtistSwatch artistId={id} styleFamily={a.styleFamily} className="h-full w-full" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-cream">{a.name}</span>
                      <span className="text-[10px] tracking-widest text-muted">{a.latinName}</span>
                    </div>
                    <div className="text-[12px]" style={{ color: a.color }}>
                      {a.tagline}
                    </div>
                    <div className="text-[11px] text-muted">全套 {a.totalCards} 幅</div>
                  </div>
                  <span className="shrink-0 font-mono text-lg text-muted/50">{id}</span>
                </div>
              );
            })}
          </div>
        </Accordion>

        <Accordion title="容易忽略的要点">
          <ul className="ml-4 list-disc space-y-1.5">
            <li>拍卖师<strong>可以</strong>竞买自己拍卖的作品，但钱要付给银行，等于净亏。</li>
            <li>触发轮次结束的第 5 幅牌<strong>计入排名</strong>——这常常是致胜手。</li>
            <li>手牌用不完不会带来任何分数，第 4 轮结束时它们一文不值。</li>
            <li>定价拍卖若无人接手，<strong>拍卖师必须按自己的定价买下</strong>，所以定价不能超过自己的现金。</li>
            <li>暗标平局时，拍卖师本人优先，其后从拍卖师左手起顺时针。</li>
          </ul>
        </Accordion>
      </div>
    </Modal>
  );
}

const DETAIL: Record<string, string> = {
  OPEN: '所有人可反复加价，每次必须高于当前最高价。最后一次加价后倒计时归零即落槌。已放弃者不能再回来，当前最高价持有者不能放弃。',
  ONE_OFFER: '从拍卖师左手边开始，每人只有一次机会：报一个高于当前最高价的数，或直接放弃。拍卖师最后一个决定，可用一元之差截胡。',
  HIDDEN: '所有人同时秘密出价（可以出 0），随后一起揭晓，最高者得。同价时拍卖师优先，其后顺时针。',
  FIXED: '拍卖师先宣布一个价格，然后从其左手边开始逐个询问是否按此价买下。第一个接受的人成交；全员放弃则拍卖师必须自己按此价买下并付给银行。',
  DOUBLE: '本身不能单独拍卖，需要追加同一位艺术家的第二幅作品（第二幅不能也是联合拍卖牌），两幅一起成交。',
};
