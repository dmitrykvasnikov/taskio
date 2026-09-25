import { Type, type Static, type TSchema } from '@sinclair/typebox';

export const IdSchema = Type.String({ format: 'uuid' });
export type Id = Static<typeof IdSchema>;

export const InstantSchema = Type.String({ format: 'date-time' });
export type Instant = Static<typeof InstantSchema>;

export const LocalDateSchema = Type.String({ format: 'date' });
export type LocalDate = Static<typeof LocalDateSchema>;

export const ErrorDetailsSchema = Type.Unknown();
export type ErrorDetails = Static<typeof ErrorDetailsSchema>;

export const ApiErrorSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    fields: Type.Optional(Type.Record(Type.String(), Type.String())),
    details: Type.Optional(ErrorDetailsSchema),
    requestId: Type.String(),
  }),
});
export type ApiError = Static<typeof ApiErrorSchema>;

export function PageSchema<T extends TSchema>(item: T) {
  return Type.Object({ items: Type.Array(item), nextCursor: Type.Union([Type.String(), Type.Null()]) });
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
