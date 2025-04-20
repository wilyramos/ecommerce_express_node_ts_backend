import mongoose, { Schema, Document, Types} from "mongoose";

export interface IToken extends Document {
    token: string
    user: Types.ObjectId
    createdAt: Date
}

const tokeSchema: Schema = new Schema({
    token: {
        type: String,
        required: true
    },
    user: {
        type: Types.ObjectId,
        ref: 'User', // Referencia a la colección de usuarios
    },
    expiresAt: {
        type: Date,
        default: Date.now,
        expires: "15m"
    }
});

const Token = mongoose.model<IToken>("Token", tokeSchema);
export default Token