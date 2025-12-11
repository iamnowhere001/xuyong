import { RenameRule } from './types';

export const INITIAL_RULE: RenameRule = {
  type: 'replace',
  find: '',
  replace: '',
  useRegex: false,
  isActive: true,
};

export const MOCK_FILES = [
  // Only used for initial layout testing if needed, mostly empty
];
