import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { connect } from 'amqplib';
import type { ChannelModel, Channel } from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: ChannelModel;
  private channel: Channel;
  private readonly rabbitmqUrl: string;
  private isConnected = false;

  constructor() {
    this.rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  async connect() {
    try {
      this.connection = await connect(this.rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      this.isConnected = true;
      console.log('RabbitMQ connected successfully');
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async waitForConnection(maxRetries = 10, delayMs = 1000): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      if (this.isConnected && this.channel) {
        return;
      }
      console.log(`Waiting for RabbitMQ connection... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    throw new Error('RabbitMQ connection timeout');
  }

  async disconnect() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      console.log('RabbitMQ disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting from RabbitMQ:', error);
    }
  }

  async publish(queue: string, message: any) {
    try {
      if (!this.channel) {
        throw new Error('RabbitMQ channel not initialized');
      }
      await this.channel.assertQueue(queue, { durable: true });
      this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
        persistent: true,
      });
      console.log(`Message sent to queue ${queue}:`, message);
    } catch (error) {
      console.error(`Error publishing to queue ${queue}:`, error);
      throw error;
    }
  }

  async consume(
    queue: string,
    callback: (message: any) => Promise<void>,
  ) {
    try {
      // Wait for connection to be established
      await this.waitForConnection();

      if (!this.channel) {
        throw new Error('RabbitMQ channel not initialized. Make sure RabbitMQ is running.');
      }
      await this.channel.assertQueue(queue, { durable: true });
      this.channel.prefetch(1);

      this.channel.consume(queue, async (msg) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            console.log(`Processing message from queue ${queue}:`, content);
            await callback(content);
            this.channel.ack(msg);
          } catch (error) {
            console.error(`Error processing message from queue ${queue}:`, error);
            this.channel.nack(msg, false, false);
          }
        }
      });

      console.log(`Consumer started for queue ${queue}`);
    } catch (error) {
      console.error(`Error setting up consumer for queue ${queue}:`, error);
      throw error;
    }
  }

  getChannel(): Channel {
    return this.channel;
  }
}