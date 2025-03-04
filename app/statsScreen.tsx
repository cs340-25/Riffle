import { View, Text, StyleSheet, Button } from 'react-native';
import { Link } from 'expo-router';

export default function StatsScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Welcome to the Stats Screen!</Text>
            <Link href="/">
                <Button title="Go Back" />
            </Link>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontSize: 20,
    },
});