import mongoose from 'mongoose';

const permissionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    module: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    isSystem: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'permissions',
  }
);

permissionSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    key: this.key,
    module: this.module,
    description: this.description,
    isSystem: this.isSystem,
  };
};

const Permission = mongoose.model('Permission', permissionSchema);

export default Permission;
