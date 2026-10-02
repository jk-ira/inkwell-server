module.exports = (sequelize, DataTypes) =>
  sequelize.define('Share', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    postId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    platform: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'link' },
  }, { tableName: 'shares', updatedAt: false });
