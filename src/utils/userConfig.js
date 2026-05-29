const NICKNAMES = [
  import.meta.env.VITE_USER0_NICKNAME || 'User 0',
  import.meta.env.VITE_USER1_NICKNAME || 'User 1',
];

export function getNickname(userIndex) {
  return NICKNAMES[userIndex] ?? `User ${userIndex}`;
}

export function getUserLabel(userIndex, activeUserIndex) {
  const name = getNickname(userIndex);
  return userIndex === activeUserIndex ? `${name} (You)` : name;
}
