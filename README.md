# imageSmartBackend


* servers:
  - url: 'image-smart.herokuapp.com'
* paths:
  * /image-detection:
      * get:
          * parameters:
              * name: url
                  *  in: query
                  *  description: url or file path of the image
                  *  required: true
              * name: type
                  *  in: query
                  *  description: type of the detection request, one of "face", "object", "landmark", "text", "color", "label"
                  *  required: true
