const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config');

const sequelize = new Sequelize(config.databaseUrl, {
  dialect: 'postgres',
  logging: false,
  define: { underscored: true }, // camelCase attributes <-> snake_case columns
  ...(process.env.DB_SSL === 'true' && { dialectOptions: { ssl: { require: true, rejectUnauthorized: false } } }),
});

const User = require('./user')(sequelize, DataTypes);
const Post = require('./post')(sequelize, DataTypes);
const Comment = require('./comment')(sequelize, DataTypes);
const Like = require('./like')(sequelize, DataTypes);
const Share = require('./share')(sequelize, DataTypes);
const AdminAction = require('./adminAction')(sequelize, DataTypes);

// Associations (foreign keys and ON DELETE rules are created by the migrations)
User.hasMany(Post, { foreignKey: 'authorId', as: 'posts', onDelete: 'CASCADE' });
Post.belongsTo(User, { foreignKey: 'authorId', as: 'author' });

Post.hasMany(Comment, { foreignKey: 'postId', as: 'comments', onDelete: 'CASCADE' });
Comment.belongsTo(Post, { foreignKey: 'postId', as: 'post' });
User.hasMany(Comment, { foreignKey: 'userId', as: 'comments', onDelete: 'CASCADE' });
Comment.belongsTo(User, { foreignKey: 'userId', as: 'author' });
Comment.hasMany(Comment, { foreignKey: 'parentId', as: 'replies', onDelete: 'CASCADE' });
Comment.belongsTo(Comment, { foreignKey: 'parentId', as: 'parent' });

Post.hasMany(Like, { foreignKey: 'postId', as: 'likes', onDelete: 'CASCADE' });
Like.belongsTo(Post, { foreignKey: 'postId', as: 'post' });
User.hasMany(Like, { foreignKey: 'userId', as: 'likes', onDelete: 'CASCADE' });
Like.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Post.hasMany(Share, { foreignKey: 'postId', as: 'shares', onDelete: 'CASCADE' });
Share.belongsTo(Post, { foreignKey: 'postId', as: 'post' });
User.hasMany(Share, { foreignKey: 'userId', as: 'shares', onDelete: 'CASCADE' });
Share.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(AdminAction, { foreignKey: 'adminId', as: 'adminActions', onDelete: 'SET NULL' });
AdminAction.belongsTo(User, { foreignKey: 'adminId', as: 'admin' });

module.exports = { sequelize, Sequelize, User, Post, Comment, Like, Share, AdminAction };
