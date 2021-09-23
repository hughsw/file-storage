import { createReadStream } from 'fs';

const main = async args => {
  try {
    console.log('main: args', '\n'+args.join('\n'));
    //const streams = args.map(filename => createReadStream(filename));
    const streams = args.map(filename => {
      const stream = createReadStream(filename);
      // if filename is a directory and the following line is commented out, NodeJS crashes while we're waiting!
      stream.on('error', error => console.log(`stream error: ${filename} : ${error}`));
      return stream;
    });
    console.log('main streams:', JSON.stringify(streams));
    console.log('main waiting...');
    await new Promise(resolve => setTimeout(resolve, 700));

    streams.map(stream => {
      //console.log('stream:', stream.path, stream._eventsCount, stream._events);
      console.log(`stream: ${stream.path}, closed: ${stream.closed}`);
    });

    console.log('main returning');
    return streams;
  }
  catch (error) {
    console.log('main: catch:', error);
    return false;
  }
  finally {
    console.log('main: finally:');
  }
}



if (require.main === module) {
  main(process.argv.slice(2))
    .then(result => console.log('result:\n', JSON.stringify(result)))
    .then(() => setTimeout(() => console.log('final setTimeout'), 700))
    .catch(error => {
      console.log('fail:', error, '\n*** fail ***');
      process.nextTick(() => process.exit(1));
    })
  ;


}
