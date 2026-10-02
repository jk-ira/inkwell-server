module.exports = (sequelize, DataTypes) =>
  sequelize.define('AdminAction', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    adminId: { type: DataTypes.UUID },
    action: { type: DataTypes.STRING(50), allowNull: false },
    targetType: { type: DataTypes.STRING(20), allowNull: false },
    targetId: { type: DataTypes.UUID },
    details: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  }, { tableName: 'admin_actions', updatedAt: false });
