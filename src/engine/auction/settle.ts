import type { AuctionOutcome, AuctionState, GameState } from '@/types/game';
import { getPlayer } from '../helpers';
import { money, pushLog } from '../log';

/**
 * 统一资金结算。
 *
 * 唯一规则：
 *   赢家支付成交价 P；收款人（拍卖师 / 共同拍卖师）各自领取自己的份额，
 *   但如果某个收款人正好就是赢家，他那一份改为进入银行。
 *
 * 这一条规则同时覆盖：
 *   - 普通拍卖：拍卖师收全款；拍卖师自购 → 全款进银行
 *   - 双重拍卖：原拍卖师 floor(P/2)、共同拍卖师 ceil(P/2)（奇数时多拿 1k）
 *   - 双重拍卖中原拍卖师自购 → 自己那半进银行，另一半仍付给共同拍卖师
 *   - 双重拍卖中共同拍卖师自购 → 自己那半进银行，仍需付另一半给原拍卖师
 */
export function settleAuction(
  state: GameState,
  auction: AuctionState,
  winnerId: string | undefined,
  price: number,
  voided: boolean,
): AuctionOutcome {
  const transfers: AuctionOutcome['transfers'] = [];
  const outcome: AuctionOutcome = {
    auctionId: auction.id,
    artworkIds: auction.artworkIds.slice(),
    auctioneerId: auction.auctioneerId,
    coAuctioneerId: auction.coAuctioneerId,
    type: auction.type,
    winnerId,
    price,
    free: !winnerId || price <= 0,
    voided,
    transfers,
  };

  // 第 5 幅作品触发轮次结束：两幅作品都不归属任何人，也不发生资金流动
  if (voided) {
    auction.artworkIds.forEach((id) => state.discardPile.push(id));
    outcome.winnerId = undefined;
    outcome.free = true;
    return outcome;
  }

  // 无人出价 → 原拍卖师免费获得，不发生资金流动
  // 注意：这里只看「有没有赢家」。定价为 0 且有人接手的极端情况仍然走正常归属流程。
  if (!winnerId) {
    const auctioneer = getPlayer(state, auction.auctioneerId);
    auction.artworkIds.forEach((id) => auctioneer.purchased.push(id));
    outcome.winnerId = auction.auctioneerId;
    outcome.price = 0;
    outcome.free = true;
    pushLog(
      state,
      'result',
      `无人出价，${auctioneer.name} 免费获得${auction.artworkIds.length > 1 ? '两幅作品' : '该作品'}`,
      { playerId: auctioneer.id },
    );
    return outcome;
  }

  const winner = getPlayer(state, winnerId);
  winner.cash -= price;

  // 计算收款份额
  const shares: { playerId: string; amount: number }[] = [];
  if (auction.coAuctioneerId) {
    const shareA = Math.floor(price / 2);
    const shareB = price - shareA; // 奇数时共同拍卖师多拿 1k
    shares.push({ playerId: auction.auctioneerId, amount: shareA });
    shares.push({ playerId: auction.coAuctioneerId, amount: shareB });
  } else {
    shares.push({ playerId: auction.auctioneerId, amount: price });
  }

  for (const s of shares) {
    if (s.amount <= 0) continue;
    if (s.playerId === winnerId) {
      // 赢家自己那份 → 进银行
      state.bank += s.amount;
      transfers.push({ from: winnerId, amount: s.amount, toBank: true });
    } else {
      const receiver = getPlayer(state, s.playerId);
      receiver.cash += s.amount;
      transfers.push({ from: winnerId, to: s.playerId, amount: s.amount });
    }
  }

  auction.artworkIds.forEach((id) => winner.purchased.push(id));

  // 日志
  const label = auction.artworkIds.length > 1 ? '两幅作品' : '该作品';
  pushLog(state, 'result', `${winner.name} 以 ${money(price)} 拍得${label}`, { playerId: winner.id });
  for (const t of transfers) {
    if (t.toBank) {
      pushLog(state, 'money', `${winner.name} 支付的 ${money(t.amount)} 进入银行`, { playerId: winner.id });
    } else if (t.to) {
      const to = getPlayer(state, t.to);
      pushLog(state, 'money', `${money(t.amount)} → ${to.name}`, { playerId: to.id });
    }
  }

  return outcome;
}
