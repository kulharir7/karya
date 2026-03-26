// backend/src/users/user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable } from 'typeorm';
import { Post } from '../posts/post.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column({ nullable: true })
  avatarUrl?: string;

  @Column({ select: false })
  password: string; // hashed

  @ManyToMany(() => User, user => user.following)
  @JoinTable({ name: 'user_follows' })
  followers: User[];

  @ManyToMany(() => User, user => user.followers)
  following: User[];

  @OneToMany(() => Post, post => post.author)
  posts: Post[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
