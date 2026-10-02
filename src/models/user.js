module.exports = (sequelize, DataTypes) =>
  sequelize.define('User', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    username: { type: DataTypes.STRING(30), allowNull: false },
    email: { type: DataTypes.STRING(254), allowNull: false },
    passwordHash: { type: DataTypes.TEXT, allowNull: false },
    displayName: { type: DataTypes.STRING(60), allowNull: false },
    bio: { type: DataTypes.STRING(500), allowNull: false, defaultValue: '' },
    role: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'user', validate: { isIn: [['user', 'admin']] } },
    status: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'active', validate: { isIn: [['active', 'suspended']] } },
    passwordChangedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    lastLoginAt: { type: DataTypes.DATE },
  }, { tableName: 'users' });
