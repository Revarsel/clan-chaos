import { z } from "zod";
import { CARD_IDS, CLAN_IDS, RESOURCE_TYPES } from "./types.js";

const id = z.string().min(1).max(64);
export const resourceTypeSchema = z.enum(RESOURCE_TYPES);
export const clanIdSchema = z.enum(CLAN_IDS);
export const cardIdSchema = z.enum(CARD_IDS);

const amount = z.number().int().min(0).max(100);
export const resourcesSchema = z.object({ gold: amount, materials: amount, food: amount });
export const partialResourcesSchema = z
  .object({ gold: amount.optional(), materials: amount.optional(), food: amount.optional() })
  .strict();

export const raidTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("player"), playerId: id }),
  z.object({ kind: z.literal("location"), locationId: id }),
]);

/** Every state-changing gameplay command accepted by the engine. */
export const gameCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("gather"), partyId: id, locationId: id }),
  z.object({ type: z.literal("recall"), partyId: id }),
  z.object({ type: z.literal("buildBarricade") }),
  z.object({ type: z.literal("repairFort") }),
  z.object({ type: z.literal("recruitMercenaries") }),
  z.object({ type: z.literal("buyCard") }),
  z.object({ type: z.literal("buyMerchantCard") }),
  z.object({ type: z.literal("clanGrowth") }),
  z.object({ type: z.literal("trainParty") }),
  z.object({ type: z.literal("scout"), targetPlayerId: id }),
  z.object({
    type: z.literal("playCard"),
    cardUid: id,
    targetPlayerId: id.optional(),
    locationId: id.optional(),
    evacuate: partialResourcesSchema.optional(),
  }),
  z.object({ type: z.literal("commitDefense"), cardUid: id }),
  z.object({
    type: z.literal("commitRaid"),
    target: raidTargetSchema,
    primaryCardUid: id.optional(),
    supportCardUid: id.optional(),
    decoyPlayerId: id.optional(),
    priority: resourceTypeSchema,
  }),
  z.object({ type: z.literal("useClanAbility") }),
  z.object({ type: z.literal("foxfireRetarget"), target: raidTargetSchema }),
  z.object({ type: z.literal("tradeOffer"), toPlayerId: id, give: partialResourcesSchema, want: partialResourcesSchema }),
  z.object({ type: z.literal("tradeRespond"), offerId: id, accept: z.boolean() }),
  z.object({ type: z.literal("tradeCancel"), offerId: id }),
  z.object({ type: z.literal("marketExchange"), give: resourceTypeSchema, get: resourceTypeSchema, amount: z.number().int().min(1).max(20) }),
  z.object({ type: z.literal("truceRespond"), accept: z.boolean() }),
]);
export type GameCommand = z.infer<typeof gameCommandSchema>;
export type GameCommandType = GameCommand["type"];

export const commandEnvelopeSchema = z.object({
  commandId: z.string().min(8).max(64),
  command: gameCommandSchema,
});
export type CommandEnvelope = z.infer<typeof commandEnvelopeSchema>;

// ---- Lobby / room payloads ----
export const guestNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(16, "Name must be 16 characters or fewer")
  .regex(/^[\p{L}\p{N} _.'-]+$/u, "Name contains unsupported characters");

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/, "Room codes are six letters or digits");

export const createRoomSchema = z.object({ name: guestNameSchema });
export const joinRoomSchema = z.object({ code: roomCodeSchema, name: guestNameSchema });
export const resumeSchema = z.object({ code: roomCodeSchema, token: z.string().min(20).max(200) });
export const selectClanSchema = z.object({ clan: clanIdSchema });
export const setReadySchema = z.object({ ready: z.boolean() });
export const kickSchema = z.object({ playerId: id });
export const chatSchema = z.object({ text: z.string().trim().min(1).max(200) });
