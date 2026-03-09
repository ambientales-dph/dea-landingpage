import { EventEmitter } from 'events';

// This is a global event emitter for Firebase errors.
// It allows us to decouple error handling from the data fetching logic.
export const errorEmitter = new EventEmitter();
