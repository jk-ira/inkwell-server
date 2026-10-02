module.exports = (sequelize, DataTypes) =>
  sequelize.define('Comment', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    postId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    parentId: { type: DataTypes.UUID },
    content: { type: DataTypes.TEXT, allowNull: false, validate: { len: [1, 2000] } },
    status: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'visible', validate: { isIn: [['visible', 'hidden', 'deleted']] } },
  }, { tableName: 'comments' });
