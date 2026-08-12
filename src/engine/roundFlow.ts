import type { ArtistId, GameState, RoundNumber } from '@/types/game';
import { allHandsEmpty, emptyRoundCounts, getArtwork, getPlayer, leftOf, seatAt } from './helpers';
import { pushLog } from './log';
import { buildRoundResult, calculateArtistRanking } from './scoring';
import { dealCountFor, dealToPlayers, sortHand } from './setup';

/** 触发轮次结束的张数阈值 */
export const ROUND_END_COUNT = 5;

/**
 * 记录一张作品被打出：更新本轮计数。
 * @returns 该艺术家本轮累计张数（打出这一张之后）
 */
export function registerPlayedCard(state: GameState, artworkId: string, playedBy: string): number {
  const art = getArtwork(state, artworkId);
  const artistId = art.artistId;
  state.roundArtworkCounts[artistId] += 1;
  state.artists[artistId].roundCounts[state.currentRound - 1] += 1;
  state.lastPlayedPlayerId = playedBy;
  return state.roundArtworkCounts[artistId];
}

export function isFifthCard(count: number): boolean {
  return count >= ROUND_END_COUNT;
}

/** 标记本轮因第 5 幅作品结束 */
export function markFifthCardEnd(state: GameState, artistId: ArtistId): void {
  state.roundEndReason = 'fifth-card';
  state.roundEndArtistId = artistId;
  pushLog(
    state,
    'round',
    `${state.artists[artistId].name} 的第 5 幅作品登场 —— 本轮立即结束，该作品不进行拍卖`,
    { artistId },
  );
}

/**
 * 一次拍卖结束后推进到下一位出牌者。
 * 起点：共同拍卖师的左手（若有），否则拍卖师的左手。
 * 手牌为空的玩家会被跳过；全员空手则本轮结束。
 */
export function advanceTurnFrom(state: GameState, anchorPlayerId: string): void {
  if (state.roundEndReason) {
    enterScoring(state);
    return;
  }
  if (allHandsEmpty(state)) {
    state.roundEndReason = 'hands-empty';
    pushLog(state, 'round', '所有经销商手牌用尽 —— 本轮结束');
    enterScoring(state);
    return;
  }

  const n = state.players.length;
  const startSeat = leftOf(state, anchorPlayerId).seatIndex;
  for (let k = 0; k < n; k++) {
    const candidate = seatAt(state, startSeat + k);
    if (candidate.hand.length > 0) {
      state.currentPlayerIndex = candidate.seatIndex;
      state.phase = 'PLAYER_TURN';
      return;
    }
  }

  state.roundEndReason = 'hands-empty';
  enterScoring(state);
}

/** 进入本轮结算：计算排名并写入累计价值，等待玩家确认 */
export function enterScoring(state: GameState): void {
  state.currentAuction = undefined;
  state.pendingDouble = undefined;
  const artists = calculateArtistRanking(state);
  state.roundResult = buildRoundResult(state, artists, [], false);
  state.phase = 'ROUND_SCORING';
}

/** 进入下一轮：补牌、重置计数、决定起始玩家 */
export function dealNextRound(state: GameState): void {
  state.currentRound = (state.currentRound + 1) as RoundNumber;
  state.roundArtworkCounts = emptyRoundCounts();
  state.roundEndReason = undefined;
  state.roundEndArtistId = undefined;
  state.lastOutcome = undefined;
  state.roundResult = undefined;

  const count = dealCountFor(state.players.length, state.currentRound);
  if (count > 0) {
    dealToPlayers(state, count);
    state.players.forEach((p) => sortHand(state, p));
    pushLog(state, 'round', `第 ${state.currentRound} 轮开始 · 每人补 ${count} 张`);
  } else {
    pushLog(state, 'round', `第 ${state.currentRound} 轮开始 · 本轮不补牌`);
  }

  // 第 4 轮不补牌，若上一轮恰好全员出光手牌，本轮无人能出牌 → 直接进入结算，
  // 否则会停在一个没有合法操作的 PLAYER_TURN 上形成死局。
  if (allHandsEmpty(state)) {
    state.roundEndReason = 'hands-empty';
    pushLog(state, 'round', '所有经销商都没有手牌 —— 本轮直接结算');
    enterScoring(state);
    return;
  }

  // 起始玩家 = 上一轮最后打出作品的玩家的左手
  const anchor = state.lastPlayedPlayerId ?? state.players[state.startingPlayerIndex].id;
  const n = state.players.length;
  const startSeat = leftOf(state, anchor).seatIndex;
  let chosen = startSeat;
  for (let k = 0; k < n; k++) {
    const candidate = seatAt(state, startSeat + k);
    if (candidate.hand.length > 0) {
      chosen = candidate.seatIndex;
      break;
    }
  }
  state.startingPlayerIndex = chosen;
  state.currentPlayerIndex = chosen;
  state.phase = 'PLAYER_TURN';
  pushLog(state, 'round', `由 ${getPlayer(state, seatAt(state, chosen).id).name} 首先出牌`);
}

/** 第 4 轮结束 → 结算最终排名 */
export function endGame(state: GameState): void {
  const ranked = [...state.players].sort((a, b) => {
    if (b.cash !== a.cash) return b.cash - a.cash;
    return a.seatIndex - b.seatIndex;
  });
  state.finalRanking = ranked.map((p) => p.id);
  state.winnerId = ranked[0]?.id;
  state.phase = 'GAME_END';
  pushLog(state, 'system', `牌局结束 · 冠军 ${ranked[0].name}，资金 €${ranked[0].cash}k`, {
    playerId: ranked[0].id,
  });
}
