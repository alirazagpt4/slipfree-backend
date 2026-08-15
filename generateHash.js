import bcrypt from 'bcryptjs';
const password = 'admin@slipfree2026!';
console.log(bcrypt.hashSync(password, 10));