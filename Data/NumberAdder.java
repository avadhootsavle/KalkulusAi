import java.util.Scanner;

public class NumberAdder {
    public static void main(String[] args) {
        // Create a Scanner object to read input from the user
        Scanner scanner = new Scanner(System.in);

        // Prompt the user to enter the first number
        System.out.print("Enter the first number: ");
        int num1 = scanner.nextInt();

        // Prompt the user to enter the second number
        System.out.print("Enter the second number: ");
        int num2 = scanner.nextInt();

        // Calculate the sum of the two numbers
        int sum = num1 + num2;

        // Display the result to the user
        System.out.println("The sum of " + num1 + " and " + num2 + " is " + sum);

        // Close the scanner to free up resources
        scanner.close();
    }
}
