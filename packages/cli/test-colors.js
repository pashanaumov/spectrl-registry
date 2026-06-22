import chalk from 'chalk';
import ora from 'ora';

console.log(chalk.red('Error: This should be red'));
console.log(chalk.green('Success: This should be green'));
console.log(chalk.yellow('Warning: This should be yellow'));
console.log(chalk.cyan('Info: This should be cyan'));
console.log(chalk.dim('Dimmed: This should be dimmed'));
console.log(chalk.bold('Bold: This should be bold'));

console.log('\n--- Testing Spinners ---\n');

// Test flip spinner
const spinner1 = ora({ text: 'Loading with flip spinner', spinner: 'line' }).start();

setTimeout(() => {
  spinner1.text = 'Still loading...';
}, 1000);

setTimeout(() => {
  spinner1.succeed('Flip spinner completed!');

  // Test another spinner
  const spinner2 = ora({ text: 'Processing data', spinner: 'line' }).start();

  setTimeout(() => {
    spinner2.fail('This one failed!');

    // Test warning
    const spinner3 = ora({ text: 'Checking something', spinner: 'line' }).start();

    setTimeout(() => {
      spinner3.warn('Warning message!');

      // Test info
      const spinner4 = ora({ text: 'Final check', spinner: 'line' }).start();

      setTimeout(() => {
        spinner4.info('Info message!');
        console.log('\n✨ All tests complete!\n');
      }, 1000);
    }, 1000);
  }, 1000);
}, 2000);
