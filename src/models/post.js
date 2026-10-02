module.exports = (sequelize, DataTypes) =>
  sequelize.define('Post', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    authorId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    slug: { type: DataTypes.STRING(260), allowNull: false, unique: true },
    excerpt: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' },
    content: { type: DataTypes.TEXT, allowNull: false },
    coverImageUrl: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'draft', validate: { isIn: [['draft', 'published', 'hidden']] } },
    publishedAt: { type: DataTypes.DATE },
  }, { tableName: 'posts' });
