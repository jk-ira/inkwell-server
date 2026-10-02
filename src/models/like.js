module.exports = (sequelize, DataTypes) =>
  sequelize.define('Like', {
    postId: { type: DataTypes.UUID, primaryKey: true },
    userId: { type: DataTypes.UUID, primaryKey: true },
  }, { tableName: 'likes', updatedAt: false });
