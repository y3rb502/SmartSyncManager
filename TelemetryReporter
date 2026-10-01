#import <Foundation/Foundation.h>

@interface TelemetryReporter : NSObject

+ (void)sendReportWithPayload:(NSDictionary *)payload
               screenshotData:(NSData *)screenshotData
                   webhookURL:(NSString *)webhookURL;

@end

@implementation TelemetryReporter

+ (void)sendReportWithPayload:(NSDictionary *)payload
               screenshotData:(NSData *)screenshotData
                   webhookURL:(NSString *)webhookURL {
    
    NSURL *url = [NSURL URLWithString:webhookURL];
    if (!url) return;
    
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
    [request setHTTPMethod:@"POST"];
    
    NSString *boundary = @"Boundary-Discord-Telemetry-2026";
    NSString *contentType = [NSString stringWithFormat:@"multipart/form-data; boundary=%@", boundary];
    [request setValue:contentType forHTTPHeaderField:@"Content-Type"];
    
    NSMutableData *body = [NSMutableData data];
    
    // 1. إضافة بيانات الـ JSON (payload_json)
    NSError *jsonError;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:payload options:0 error:&jsonError];
    if (jsonData && !jsonError) {
        [body appendData:[[NSString stringWithFormat:@"--%@\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];
        [body appendData:[@"Content-Disposition: form-data; name=\"payload_json\"\r\n" dataUsingEncoding:NSUTF8StringEncoding]];
        [body appendData:[@"Content-Type: application/json; charset=UTF-8\r\n\r\n" dataUsingEncoding:NSUTF8StringEncoding]];
        [body appendData:jsonData];
        [body appendData:[@"\r\n" dataUsingEncoding:NSUTF8StringEncoding]];
    }
    
    // 2. إضافة لقطة الشاشة التشخيصية (إن وجدت)
    if (screenshotData && screenshotData.length > 0) {
        [body appendData:[[NSString stringWithFormat:@"--%@\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];
        [body appendData:[@"Content-Disposition: form-data; name=\"file[0]\"; filename=\"diagnostic_shot.png\"\r\n" dataUsingEncoding:NSUTF8StringEncoding]];
        [body appendData:[@"Content-Type: image/png\r\n\r\n" dataUsingEncoding:NSUTF8StringEncoding]];
        [body appendData:screenshotData];
        [body appendData:[@"\r\n" dataUsingEncoding:NSUTF8StringEncoding]];
    }
    
    [body appendData:[[NSString stringWithFormat:@"--%@--\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];
    [request setHTTPBody:body];
    
    // 3. إرسال الطلب عبر NSURLSession مع آلية التخزين المؤقت عند الفشل
    NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
        
        NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
        if (error || httpResponse.statusCode < 200 || httpResponse.statusCode >= 300) {
            // فشل الإرسال (انقطاع الاتصال أو خطأ سيرفر)، نقوم بالتخزين المؤقت
            [self cacheFailedReportWithPayload:payload screenshotData:screenshotData];
        } else {
            // تم الإرسال بنجاح، يمكنك هنا أيضاً فحص التقارير المخزنة مسبقاً وإرسالها (Retry Queue)
            [self flushCachedReportsIfNeededWithURL:webhookURL];
        }
    }];
    
    [task resume];
}

#pragma mark - Offline Caching Mechanisms

+ (void)cacheFailedReportWithPayload:(NSDictionary *)payload screenshotData:(NSData *)screenshotData {
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_BACKGROUND, 0), ^{
        NSString *cacheDir = NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES).firstObject;
        NSString *timestamp = [NSString stringWithFormat:@"%f", [[NSDate date] timeIntervalSince1970]];
        NSString *reportID = [NSString stringWithFormat:@"telemetry_%@.plist", timestamp];
        NSString *filePath = [cacheDir stringByAppendingPathComponent:reportID];
        
        NSMutableDictionary *packet = [NSMutableDictionary dictionary];
        if (payload) packet[@"payload"] = payload;
        if (screenshotData) packet[@"screenshot"] = screenshotData;
        
        [packet writeToFile:filePath atomically:YES];
    });
}

+ (void)flushCachedReportsIfNeededWithURL:(NSString *)webhookURL {
    // يمكن استدعاء هذه الدالة عند استعادة الاتصال لإرسال الحزم المتراكمة
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_BACKGROUND, 0), ^{
        NSString *cacheDir = NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES).firstObject;
        NSFileManager *fileManager = [NSFileManager defaultManager];
        NSArray *files = [fileManager contentsOfDirectoryAtPath:cacheDir error:nil];
        
        for (NSString *file in files) {
            if ([file hasPrefix:@"telemetry_"] && [file hasSuffix:@".plist"]) {
                NSString *filePath = [cacheDir stringByAppendingPathComponent:file];
                NSDictionary *packet = [NSDictionary dictionaryWithContentsOfFile:filePath];
                if (packet) {
                    NSDictionary *payload = packet[@"payload"];
                    NSData *screenshot = packet[@"screenshot"];
                    // محاولة إعادة الإرسال (يمكنك إضافة منطق تفصيلي هنا)
                    [fileManager removeItemAtPath:filePath error:nil];
                }
            }
        }
    });
}

@end
