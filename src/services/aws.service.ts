import aws from "aws-sdk";

export default class AWS {
  private s3: aws.S3;
  private url: string;
  private publicBucketUrl: string;

  constructor(accountid: string, accessKey: string, secretKey: string) {
    this.url = `https://${accountid}.r2.cloudflarestorage.com`;
    this.publicBucketUrl =
      "https://pub-31c2f82abfa6485d91bbd537237c65b9.r2.dev"; // TODO: Remove hardcode
    this.s3 = new aws.S3({
      endpoint: this.url,
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      signatureVersion: "v4",
    });
  }

  uploadImageBufferToS3 = async (
    bucketName: string,
    buffer: Buffer,
    key: string,
    format: string
  ): Promise<string> => {
    try {
      const params = {
        ContentType: `image/${format}`,
        ContentLength: buffer.length, // or response.header["content-length"] if available for the type of file downloaded
        Bucket: bucketName,
        Body: buffer,
        Key: `${key}.${format}`,
      };
      await this.s3.putObject(params).promise();
      return `${this.publicBucketUrl}/${key}.${format}`;
    } catch (e) {
      console.error("Error uploading to S3", e);
    }
  };
}
