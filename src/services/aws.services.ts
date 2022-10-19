import aws from "aws-sdk";

export default class AWS {
  private s3: aws.S3;
  private bucketName: string;

  constructor(accessKey: string, secretKey: string, bucketName: string) {
    aws.config.credentials = new aws.Credentials(accessKey, secretKey);
    this.bucketName = bucketName;
    this.s3 = new aws.S3();
  }

  uploadImageBufferToS3 = async (
    buffer: Buffer,
    key: string
  ): Promise<string> => {
    try {
      const params = {
        ContentType: "image/png",
        ContentLength: buffer.length, // or response.header["content-length"] if available for the type of file downloaded
        Bucket: this.bucketName,
        Body: buffer,
        Key: key,
      };
      await this.s3.putObject(params).promise();
      return `https://${this.bucketName}.s3.amazonaws.com/${key}`;
    } catch (e) {
      console.error("Error uploading to S3", e);
    }
  };
}
